const express = require('express');
const router = express.Router();
const { getPool } = require('../../db'); // Updated path

// Middleware para verificar se o usuário é administrador
const verificarAdministrador = async (req, res, next) => {
    const { adminID } = req.body;
    try {
        const pool = getPool();
        const query = 'SELECT utilizadorAdministrador FROM servicosBD.Credenciais WHERE credenciaisID = $1';
        const result = await pool.query(query, [adminID]);
        if (result.rows.length > 0 && result.rows[0].utilizadoradministrador) {
            next();
        } else {
            res.status(403).send('Acesso negado. Apenas administradores podem aprovar encomendas.');
        }
    } catch (error) {
        res.status(400).send(error.message);
    }
};

// Rota para aprovar encomendas (apenas administradores)
router.post('/aprovar', verificarAdministrador, async (req, res) => {
    const { encomendaID } = req.body;
    try {
        const pool = getPool();
        const query = `
            UPDATE servicosBD.Encomenda
            SET aprovadoPorAdministrador = true
            WHERE encomendaID = $1
        `;
        await pool.query(query, [encomendaID]);
        res.status(200).send('Encomenda aprovada com sucesso');
    } catch (error) {
        res.status(400).send(error.message);
    }
});

module.exports = router;
