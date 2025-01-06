const express = require('express');
const router = express.Router();
const { getPool } = require('../../db'); // Updated path

// Function to balance stock
const balanceStock = async (req, res) => {
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
    const medications = result.rows;
    const response = [];

    for (const med of medications) {
      if (med.quantidadedisponivel < med.quantidademinima) {
        const message = `Need to restock: ${med.nomemedicamento}, Service: ${med.localidadeServico || 'Unknown'} (${med.tipoServico || 'Unknown'})`;
        console.log(message);
        response.push(message);

        const excessUnitsQuery = `
          SELECT servicoid, quantidadedisponivel
          FROM servicosBD.Medicamento_Servico_Hospitalar
          WHERE medicamentoid = $1 AND quantidadedisponivel > quantidademinima
          ORDER BY quantidadedisponivel DESC
        `;
        const excessUnits = await pool.query(excessUnitsQuery, [med.medicamentoid]);

        for (const unit of excessUnits.rows) {
          let excess = unit.quantidadedisponivel - med.quantidademinima;
          if (excess > 0) {
            const transferQuery = `
              UPDATE servicosBD.Medicamento_Servico_Hospitalar
              SET quantidadedisponivel = quantidadedisponivel - $1
              WHERE medicamentoid = $2 AND servicoid = $3;
              UPDATE servicosBD.Medicamento_Servico_Hospitalar
              SET quantidadedisponivel = quantidadedisponivel + $1
              WHERE medicamentoid = $2 AND servicoid = $4
            `;
            await pool.query(transferQuery, [excess, med.medicamentoid, unit.servicoid, med.servicoid]);

            const currentQuantityQuery = `
              SELECT quantidadedisponivel
              FROM servicosBD.Medicamento_Servico_Hospitalar
              WHERE medicamentoid = $1 AND servicoid = $2
            `;
            const currentQuantityResult = await pool.query(currentQuantityQuery, [med.medicamentoid, med.servicoid]);
            if (currentQuantityResult.rows[0].quantidadedisponivel >= med.quantidademinima) {
              break;
            }
          }
        }

        const finalCurrentQuantityQuery = `
          SELECT quantidadedisponivel
          FROM servicosBD.Medicamento_Servico_Hospitalar
          WHERE medicamentoid = $1 AND servicoid = $2
        `;
        const finalCurrentQuantityResult = await pool.query(finalCurrentQuantityQuery, [med.medicamentoid, med.servicoid]);
        if (finalCurrentQuantityResult.rows[0].quantidadedisponivel < med.quantidademinima) {
          const checkRequestQuery = `
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
          const checkRequestResult = await pool.query(checkRequestQuery, [med.medicamentoid]);
          if (checkRequestResult.rows[0].count == 0) {
            const createRequestQuery = `
              INSERT INTO servicosBD.Requisicao (estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega)
              VALUES (1, 1, 1, false, false, NOW(), NOW() + interval '7 days')
              RETURNING requisicaoID
            `;
            const createRequestResult = await pool.query(createRequestQuery);
            const newRequestID = createRequestResult.rows[0].requisicaoid;

            const linkMedicationQuery = `
              INSERT INTO servicosBD.Medicamento_Encomenda (medicamentoID, requisicaoID, quantidade)
              VALUES ($1, $2, $3)
            `;
            await pool.query(linkMedicationQuery, [med.medicamentoid, newRequestID, med.quantidademinima - finalCurrentQuantityResult.rows[0].quantidadedisponivel]);

            const requestMessage = `Request created for ${med.nomemedicamento}, Service: ${med.localidadeServico || 'Unknown'} (${med.tipoServico || 'Unknown'})`;
            console.log(requestMessage);
            response.push(requestMessage);
          } else {
            const existingRequestMessage = `Request already exists for ${med.nomemedicamento}, Service: ${med.localidadeServico || 'Unknown'} (${med.tipoServico || 'Unknown'})`;
            console.log(existingRequestMessage);
            response.push(existingRequestMessage);
          }
        }
      }
    }
    res.status(200).json(response);
  } catch (error) {
    console.error('Error balancing stock:', error.message);
    res.status(500).send('Error balancing stock');
  }
};

// Route to balance stock
router.get('/balance', balanceStock);

module.exports = router;
