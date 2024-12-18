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

// Rota para listar todas as requisições (GET /api/requisicao/)
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const query = `SELECT * FROM servicosBD.Requisicao`;  // Fetch all requisicoes
    const result = await pool.query(query);

    if (result.rows.length > 0) {
      res.status(200).json(result.rows);
    } else {
      res.status(200).json({ message: 'Nenhuma requisição encontrada.' });
    }
  } catch (error) {
    console.error('Erro ao listar requisições:', error.message);
    res.status(500).send('Erro ao listar requisições');
  }
});

// Rota para criar uma nova requisição (POST /api/requisicao/create)
router.post('/create', async (req, res) => {
  const { estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega } = req.body;
  try {
    const pool = getPool();
    const result = await pool.query(
      'INSERT INTO servicosBD.Requisicao (estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega]
    );
    res.status(201).send('Requisição criada com sucesso');
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// Rota para verificar requisições por aprovar por administrador (GET /api/requisicao/pendentes-aprovacao)
router.get('/pendentes-aprovacao', async (req, res) => {
  try {
    const pool = getPool();
    const query = `
      SELECT req.*, pro.nomeProprio, pro.ultimoNome 
      FROM servicosBD.Requisicao req
      JOIN servicosBD.Profissional_De_Saude pro ON req.profissionalID = pro.profissionalID
      WHERE req.aprovadoPorAdministrador = false
    `;
    const result = await pool.query(query);

    if (result.rows.length > 0) {
      console.log('Requisições pendentes de aprovação:');
      result.rows.forEach((row) => {
        console.log(`- ID: ${row.requisicaoid}, Nome: ${row.nomeProprio} ${row.ultimoNome}, Data Requisição: ${row.dataRequisicao}`);
      });
      res.status(200).json(result.rows);
    } else {
      console.log('Nenhuma requisição pendente de aprovação.');
      res.status(200).json({ message: 'Nenhuma requisição pendente de aprovação.' });
    }
  } catch (error) {
    console.error('Erro ao verificar requisições pendentes:', error.message);
    res.status(500).send('Erro ao verificar requisições pendentes');
  }
});

// Rota para listar todas as requisições de uma unidade de saúde (GET /api/requisicao/list/:servicoID)
router.get('/list/:servicoID', async (req, res) => {
  const { servicoID } = req.params;
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT req.*, pro.nomeProprio, pro.ultimoNome 
       FROM servicosBD.Requisicao req
       JOIN servicosBD.Profissional_De_Saude pro ON req.profissionalID = pro.profissionalID
       WHERE pro.servicoID = $1`,
      [servicoID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(400).send(error.message);
  }
});

// Rota para aprovar uma requisição (PUT /api/requisicao/aprovar/:requisicaoID)
router.put('/aprovar/:requisicaoID', async (req, res) => {
  const { requisicaoID } = req.params;

  try {
    const pool = getPool();
    const query = `
      UPDATE servicosBD.Requisicao
      SET aprovadoPorAdministrador = true
      WHERE requisicaoID = $1
      RETURNING *
    `;

    const result = await pool.query(query, [requisicaoID]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Requisição não encontrada ou já aprovada.' });
    }

    res.status(200).json({ message: 'Requisição aprovada com sucesso.', requisicao: result.rows[0] });
  } catch (error) {
    console.error('Erro ao aprovar requisição:', error.message);
    res.status(500).send('Erro ao aprovar requisição');
  }
});

// Rota para excluir uma requisição (DELETE /api/requisicao/requisicoes/:requisicaoID)
router.delete('/requisicoes/:requisicaoID', async (req, res) => {
  const { requisicaoID } = req.params;

  try {
    const pool = getPool();

    // Delete the Requisicao
    const deleteRequisicaoQuery = `
      DELETE FROM servicosBD.Requisicao
      WHERE requisicaoID = $1
      RETURNING *
    `;
    const result = await pool.query(deleteRequisicaoQuery, [requisicaoID]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Requisição não encontrada.' });
    }

    res.status(200).json({ message: 'Requisição excluída com sucesso.', requisicao: result.rows[0] });
  } catch (error) {
    console.error('Erro ao excluir requisição:', error.message);
    res.status(500).send('Erro ao excluir requisição');
  }
});

module.exports = router;
