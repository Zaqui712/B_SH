const express = require('express'); 
const router = express.Router();
const { getPool } = require('../../db'); // Updated path

// Function to generate orders
const generateOrders = async (req, res) => {
  try {
    const pool = await getPool();
    const query = `
      SELECT msh.medicamentoid, msh.servicoid, msh.quantidadedisponivel, msh.quantidademinima,
             m.nomeMedicamento, tm.descricao, sh.localidadeServico
      FROM SERVICOSDB.dbo.Medicamento_Servico_Hospitalar msh
      JOIN SERVICOSDB.dbo.Medicamento m ON msh.medicamentoid = m.medicamentoid
      JOIN SERVICOSDB.dbo.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
      JOIN SERVICOSDB.dbo.Servico_Hospitalar sh ON msh.servicoid = sh.servicoid
    `;
    const result = await pool.request().query(query);
    const medications = result.recordset;

    for (const med of medications) {
      if (med.quantidadedisponivel < med.quantidademinima) {
        console.log(`Need to order: ${med.nomeMedicamento}, Service: ${med.localidadeServico || 'Unknown'}`);

        const checkOrderQuery = `
          SELECT COUNT(*) AS count
          FROM SERVICOSDB.dbo.Encomenda
          WHERE fornecedorID = 1 AND adminID = 1 AND estadoID = 1 AND encomendaCompleta = 0
          AND dataEncomenda >= DATEADD(day, -1, GETDATE())
          AND encomendaID IN (
            SELECT encomendaID
            FROM SERVICOSDB.dbo.Medicamento_Encomenda
            WHERE medicamentoID = @medicamentoID
          )
        `;
        const checkOrderResult = await pool.request().input('medicamentoID', med.medicamentoid).query(checkOrderQuery);
        if (checkOrderResult.recordset[0].count == 0) {
          const createOrderQuery = `
            INSERT INTO SERVICOSDB.dbo.Encomenda (estadoID, adminID, fornecedorID, aprovadoPorAdministrador, encomendaCompleta, dataEncomenda, dataEntrega, quantidadeEnviada)
            VALUES (1, 1, 1, 0, 0, GETDATE(), DATEADD(day, 7, GETDATE()), @quantidadeEnviada)
            OUTPUT INSERTED.encomendaID
          `;
          const createOrderResult = await pool.request()
            .input('quantidadeEnviada', med.quantidademinima - med.quantidadedisponivel)
            .query(createOrderQuery);
          const newOrderID = createOrderResult.recordset[0].encomendaID;

          const linkMedicationQuery = `
            INSERT INTO SERVICOSDB.dbo.Medicamento_Encomenda (medicamentoID, encomendaID, quantidade)
            VALUES (@medicamentoID, @encomendaID, @quantidade)
          `;
          await pool.request()
            .input('medicamentoID', med.medicamentoid)
            .input('encomendaID', newOrderID)
            .input('quantidade', med.quantidademinima - med.quantidadedisponivel)
            .query(linkMedicationQuery);

          console.log(`Order created for ${med.nomeMedicamento}, Service: ${med.localidadeServico || 'Unknown'}`);
        } else {
          console.log(`Order already exists for ${med.nomeMedicamento}, Service: ${med.localidadeServico || 'Unknown'}`);
        }
      }
    }
    res.status(200).send('Orders generated successfully');
  } catch (error) {
    console.error('Error generating orders:', error.message);
    res.status(500).send('Error generating orders');
  }
};

// Route to generate orders
router.get('/generate', generateOrders);

module.exports = router;
