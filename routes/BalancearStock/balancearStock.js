const express = require('express');
const router = express.Router();
const { getPool } = require('../../db'); // Updated path

// Function to balance stock
const balancearStock = async (req, res) => {
    try {
        const pool = getPool();
        const query = `
            SELECT msh.medicamentoid, msh.servicoid, msh.quantidadedisponivel, msh.quantidademinima,
                   m.nomeMedicamento, tm.descricao, sh.localidadeServico, ts.descricao AS tipoServico
            FROM servicosBD.Medicamento_Servico_Hospitalar msh
            JOIN servicosBD.Medicamento m ON msh.medicamentoid = m.medicamentoid
            JOIN servicosBD.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
            JOIN servicosBD.Servico_Hospitalar sh ON msh.servicoid = sh.servicoid
            JOIN servicosBD.Tipo_Servico ts ON sh.tipoID = ts.tipoID
        `;
        const result = await pool.query(query);
        const medicamentos = result.rows;
        const response = [];

        for (const med of medicamentos) {
            if (med.quantidadedisponivel < med.quantidademinima) {
                const message = `Necessário reabastecer: ${med.nomemedicamento}, Serviço: ${med.localidadeServico || 'Desconhecido'} (${med.tipoServico || 'Desconhecido'})`;
                console.log(message);
                response.push(message);

                const unidadesComExcessoQuery = `
                    SELECT servicoid, quantidadedisponivel
                    FROM servicosBD.Medicamento_Servico_Hospitalar
                    WHERE medicamentoid = $1 AND quantidadedisponivel > quantidademinima
                    ORDER BY quantidadedisponivel DESC
                `;
                const unidadesComExcesso = await pool.query(unidadesComExcessoQuery, [med.medicamentoid]);
                
                for (const unidade of unidadesComExcesso.rows) {
                    let excesso = unidade.quantidadedisponivel - med.quantidademinima;
                    if (excesso > 0) {
                        const transferirQuery = `
                            UPDATE servicosBD.Medicamento_Servico_Hospitalar
                            SET quantidadedisponivel = quantidadedisponivel - $1
                            WHERE medicamentoid = $2 AND servicoid = $3;
                            UPDATE servicosBD.Medicamento_Servico_Hospitalar
                            SET quantidadedisponivel = quantidadedisponivel + $1
                            WHERE medicamentoid = $2 AND servicoid = $4
                        `;
                        await pool.query(transferirQuery, [excesso, med.medicamentoid, unidade.servicoid, med.servicoid]);

                        const atualQuantidadeQuery = `
                            SELECT quantidadedisponivel
                            FROM servicosBD.Medicamento_Servico_Hospitalar
                            WHERE medicamentoid = $1 AND servicoid = $2
                        `;
                        const atualQuantidadeResult = await pool.query(atualQuantidadeQuery, [med.medicamentoid, med.servicoid]);
                        if (atualQuantidadeResult.rows[0].quantidadedisponivel >= med.quantidademinima) {
                            break;
                        }
                    }
                }

                const atualQuantidadeFinalQuery = `
                    SELECT quantidadedisponivel
                    FROM servicosBD.Medicamento_Servico_Hospitalar
                    WHERE medicamentoid = $1 AND servicoid = $2
                `;
                const atualQuantidadeFinalResult = await pool.query(atualQuantidadeFinalQuery, [med.medicamentoid, med.servicoid]);
                if (atualQuantidadeFinalResult.rows[0].quantidadedisponivel < med.quantidademinima) {
                    const verificarRequisicaoQuery = `
                        SELECT COUNT(*) AS count
                        FROM servicosBD.Requisicao
                        WHERE profissionalID = 1 AND adminID = 1 AND estadoID = 1 AND requisicaoCompleta = false
                        AND dataRequisicao >= NOW() - interval '1 day'
                        AND requisicaoID IN (
                            SELECT requisicaoID
                            FROM servicosBD.Medicamento_Encomenda
                            WHERE medicamentoID = $1
                        )
                    `;
                    const verificarRequisicaoResult = await pool.query(verificarRequisicaoQuery, [med.medicamentoid]);
                    if (verificarRequisicaoResult.rows[0].count == 0) {
                        const criarRequisicaoQuery = `
                            INSERT INTO servicosBD.Requisicao (estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega)
                            VALUES (1, 1, 1, false, false, NOW(), NOW() + interval '7 days')
                            RETURNING requisicaoID
                        `;
                        const criarRequisicaoResult = await pool.query(criarRequisicaoQuery);
                        const novaRequisicaoID = criarRequisicaoResult.rows[0].requisicaoid;

                        const vincularMedicamentoQuery = `
                            INSERT INTO servicosBD.Medicamento_Encomenda (medicamentoID, requisicaoID, quantidade)
                            VALUES ($1, $2, $3)
                        `;
                        await pool.query(vincularMedicamentoQuery, [med.medicamentoid, novaRequisicaoID, med.quantidademinima - atualQuantidadeFinalResult.rows[0].quantidadedisponivel]);

                        const requisicaoMessage = `Requisição criada para ${med.nomemedicamento}, Serviço: ${med.localidadeServico || 'Desconhecido'} (${med.tipoServico || 'Desconhecido'})`;
                        console.log(requisicaoMessage);
                        response.push(requisicaoMessage);
                    } else {
                        const requisicaoExistenteMessage = `Requisição já existente para ${med.nomemedicamento}, Serviço: ${med.localidadeServico || 'Desconhecido'} (${med.tipoServico || 'Desconhecido'})`;
                        console.log(requisicaoExistenteMessage);
                        response.push(requisicaoExistenteMessage);
                    }
                }
            }
        }
        res.status(200).json(response);
    } catch (error) {
        console.error('Error ao balancear o stock:', error.message);
        res.status(500).send('Error ao balancear o stock');
    }
};

// Route to balance stock
router.get('/balance', balancearStock);

module.exports = router;
