const express = require('express');
const router = express.Router();
const { getPool } = require('../../db'); // Updated path

// Rota para criar uma nova requisição
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

// Rota para listar todas as requisições de uma unidade de saúde
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
        res.status(400).send(error.message);
    }
});

module.exports = router;
