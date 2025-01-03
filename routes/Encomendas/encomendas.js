const express = require('express');
const cors = require('cors'); // Import cors
const router = express.Router();
const { getPool } = require('../../db'); // Updated path

// Enable CORS for all origins
const corsOptions = {
  origin: '*', // Allow all origins (you can restrict this to specific domains in production)
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply CORS middleware globally
router.use(cors(corsOptions));

//Precisa de patch -- undefined no campo aprovado e completo. verificar e validar
// Rota para criar uma encomenda manual
router.post('/create', async (req, res) => {
    const { estadoID, adminID, fornecedorID, aprovadoPorAdministrador, encomendaCompleta, dataEncomenda, dataEntrega, quantidadeEnviada, medicamentos } = req.body;
    try {
        if (!estadoID || !adminID || !fornecedorID || aprovadoPorAdministrador === undefined || encomendaCompleta === undefined || !dataEncomenda || !medicamentos || medicamentos.length === 0) {
            throw new Error('Todos os campos são obrigatórios');
        }

        const pool = getPool();
        const criarEncomendaQuery = `
            INSERT INTO servicosBD.Encomenda (estadoID, adminID, fornecedorID, aprovadoPorAdministrador, encomendaCompleta, dataEncomenda, dataEntrega, quantidadeEnviada)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING encomendaID
        `;
        const criarEncomendaResult = await pool.query(criarEncomendaQuery, [estadoID, adminID, fornecedorID, aprovadoPorAdministrador, encomendaCompleta, dataEncomenda, dataEntrega, quantidadeEnviada]);
        const novaEncomendaID = criarEncomendaResult.rows[0].encomendaid;

        // Vincular medicamentos à encomenda
        for (const med of medicamentos) {
            const vincularMedicamentoQuery = `
                INSERT INTO servicosBD.Medicamento_Encomenda (medicamentoID, encomendaID, quantidade)
                VALUES ($1, $2, $3)
            `;
            await pool.query(vincularMedicamentoQuery, [med.medicamentoID, novaEncomendaID, med.quantidade]);
        }

        res.status(201).send('Encomenda criada com sucesso');
    } catch (error) {
        res.status(400).send(error.message);
    }
});

// Rota para listar encomendas pendentes de aprovação
router.get('/pendentes-aprovacao', async (req, res) => {
    try {
        const pool = getPool();
        const query = `
            SELECT e.*, a.nomeProprio, a.ultimoNome
            FROM servicosBD.Encomenda e
            JOIN servicosBD.Administrador a ON e.adminID = a.adminID
            WHERE e.aprovadoPorAdministrador = false
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(400).send(error.message);
    }
});

// Rota para aprovar uma encomenda
router.put('/aprovar/:encomendaID', async (req, res) => {
  const { encomendaID } = req.params;

  try {
    const pool = getPool();
    const query = `
      UPDATE servicosBD.Encomenda
      SET aprovadoPorAdministrador = true
      WHERE encomendaID = $1
      RETURNING *
    `;

    const result = await pool.query(query, [encomendaID]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Encomenda não encontrada ou já aprovada.' });
    }

    res.status(200).json({ message: 'Encomenda aprovada com sucesso.', encomenda: result.rows[0] });
  } catch (error) {
    console.error('Erro ao aprovar encomenda:', error.message);
    res.status(500).send('Erro ao aprovar encomenda');
  }
});

// Rota para excluir uma encomenda
router.delete('/encomendas/:encomendaID', async (req, res) => {
  const { encomendaID } = req.params;

  try {
    const pool = getPool();

    // First, delete any associated Medicamento_Encomenda entries
    const deleteMedicamentosQuery = `
      DELETE FROM servicosBD.Medicamento_Encomenda
      WHERE encomendaID = $1
    `;
    await pool.query(deleteMedicamentosQuery, [encomendaID]);

    // Then, delete the Encomenda itself
    const deleteEncomendaQuery = `
      DELETE FROM servicosBD.Encomenda
      WHERE encomendaID = $1
      RETURNING *
    `;
    const result = await pool.query(deleteEncomendaQuery, [encomendaID]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Encomenda não encontrada.' });
    }

    res.status(200).json({ message: 'Encomenda excluída com sucesso.', encomenda: result.rows[0] });
  } catch (error) {
    console.error('Erro ao excluir encomenda:', error.message);
    res.status(500).send('Erro ao excluir encomenda');
  }
});

// Rota para listar todas as encomendas 
//Reparar estado
router.get('/todas', async (req, res) => {
    try {
        const pool = getPool();
        const query = `
            SELECT e.*, a.nomeProprio, a.ultimoNome, f.nomeFornecedor
            FROM servicosBD.Encomenda e
            JOIN servicosBD.Administrador a ON e.adminID = a.adminID
            JOIN servicosBD.Fornecedor f ON e.fornecedorID = f.fornecedorID
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(400).send(error.message);
    }
});



module.exports = router;
