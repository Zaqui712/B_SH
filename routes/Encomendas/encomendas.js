const express = require('express');
const router = express.Router();
const { getPool } = require('../../db'); // Updated path

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

// Rota para listar todas as encomendas
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
