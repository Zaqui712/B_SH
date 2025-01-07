const express = require('express');
const router = express.Router();
const { executeQuery } = require('../../db'); // Updated path

// Function to balance stock
const balanceStock = async (req, res) => {
  try {
    const query = `
      SELECT msh.medicamentoid, msh.servicoid, msh.quantidadedisponivel, msh.quantidademinima,
             m.nomeMedicamento, tm.descricao, sh.localidadeServico
      FROM SERVICOSDB.dbo.Medicamento_Servico_Hospitalar msh
      JOIN SERVICOSDB.dbo.Medicamento m ON msh.medicamentoid = m.medicamentoid
      JOIN SERVICOSDB.dbo.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
      JOIN SERVICOSDB.dbo.Servico_Hospitalar sh ON msh.servicoid = sh.servicoid
    `;
    const result = await executeQuery(query);
    const medications = result.recordset;
    const response = [];

    for (const med of medications) {
      if (med.quantidadedisponivel < med.quantidademinima) {
        const message = `Need to restock: ${med.nomeMedicamento}, Service: ${med.localidadeServico || 'Unknown'}`;
        console.log(message);
        response.push(message);

        const excessUnitsQuery = `
          SELECT servicoid, quantidadedisponivel
          FROM SERVICOSDB.dbo.Medicamento_Servico_Hospitalar
          WHERE medicamentoid = @medicamentoid AND quantidadedisponivel > quantidademinima
          ORDER BY quantidadedisponivel DESC
        `;
        const excessUnits = await executeQuery(excessUnitsQuery, { medicamentoid: med.medicamentoid });

        for (const unit of excessUnits) {
          let excess = unit.quantidadedisponivel - med.quantidademinima;
          if (excess > 0) {
            const transferQuery = `
              UPDATE SERVICOSDB.dbo.Medicamento_Servico_Hospitalar
              SET quantidadedisponivel = quantidadedisponivel - @excess
              WHERE medicamentoid = @medicamentoid AND servicoid = @servicoid;
              UPDATE SERVICOSDB.dbo.Medicamento_Servico_Hospitalar
              SET quantidadedisponivel = quantidadedisponivel + @excess
              WHERE medicamentoid = @medicamentoid AND servicoid = @targetServicoid
            `;
            await executeQuery(transferQuery, { excess, medicamentoid: med.medicamentoid, servicoid: unit.servicoid, targetServicoid: med.servicoid });

            const currentQuantityQuery = `
              SELECT quantidadedisponivel
              FROM SERVICOSDB.dbo.Medicamento_Servico_Hospitalar
              WHERE medicamentoid = @medicamentoid AND servicoid = @servicoid
            `;
            const currentQuantityResult = await executeQuery(currentQuantityQuery, { medicamentoid: med.medicamentoid, servicoid: med.servicoid });
            if (currentQuantityResult[0].quantidadedisponivel >= med.quantidademinima) {
              break;
            }
          }
        }

        const finalCurrentQuantityQuery = `
          SELECT quantidadedisponivel
          FROM SERVICOSDB.dbo.Medicamento_Servico_Hospitalar
          WHERE medicamentoid = @medicamentoid AND servicoid = @servicoid
        `;
        const finalCurrentQuantityResult = await executeQuery(finalCurrentQuantityQuery, { medicamentoid: med.medicamentoid, servicoid: med.servicoid });
        if (finalCurrentQuantityResult[0].quantidadedisponivel < med.quantidademinima) {
          const checkRequestQuery = `
            SELECT COUNT(*) AS count
            FROM SERVICOSDB.dbo.Requisicao
            WHERE profissionalID = 1 AND adminID = 1 AND estadoID = 1 AND requisicaoCompleta = 0
            AND dataRequisicao >= DATEADD(day, -1, GETDATE())
            AND requisicaoID IN (
              SELECT requisicaoID
              FROM SERVICOSDB.dbo.Medicamento_Encomenda
              WHERE medicamentoID = @medicamentoid
            )
          `;
          const checkRequestResult = await executeQuery(checkRequestQuery, { medicamentoid: med.medicamentoid });
          if (checkRequestResult[0].count == 0) {
            const createRequestQuery = `
              INSERT INTO SERVICOSDB.dbo.Requisicao (estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega)
              VALUES (1, 1, 1, 0, 0, GETDATE(), DATEADD(day, 7, GETDATE()))
              RETURNING requisicaoID
            `;
            const createRequestResult = await executeQuery(createRequestQuery);
            const newRequestID = createRequestResult[0].requisicaoID;

            const linkMedicationQuery = `
              INSERT INTO SERVICOSDB.dbo.Medicamento_Encomenda (medicamentoID, requisicaoID, quantidade)
              VALUES (@medicamentoid, @requisicaoID, @quantidade)
            `;
            await executeQuery(linkMedicationQuery, { medicamentoid: med.medicamentoid, requisicaoID: newRequestID, quantidade: med.quantidademinima - finalCurrentQuantityResult[0].quantidadedisponivel });

            const requestMessage = `Request created for ${med.nomeMedicamento}, Service: ${med.localidadeServico || 'Unknown'}`;
            console.log(requestMessage);
            response.push(requestMessage);
          } else {
            const existingRequestMessage = `Request already exists for ${med.nomeMedicamento}, Service: ${med.localidadeServico || 'Unknown'}`;
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
