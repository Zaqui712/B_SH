const express = require('express');
const router = express.Router();
const { getPool } = require('../../db'); // Updated path

// Function to generate orders
const generateOrders = async (req, res) => {
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

    for (const med of medications) {
      if (med.quantidadedisponivel < med.quantidademinima) {
        console.log(`Need to order: ${med.nomemedicamento}, Service: ${med.localidadeServico || 'Unknown'} (${med.tipoServico || 'Unknown'})`);

        const checkOrderQuery = `
          SELECT COUNT(*) AS count
          FROM servicosBD.Encomenda
          WHERE fornecedorID = 1 AND adminID = 1 AND estadoID = 1 AND encomendaCompleta = false
          AND dataEncomenda >= NOW() - interval '1 day'
          AND encomendaID IN (
            SELECT encomendaID
            FROM servicosBD.Medicamento_Encomenda
            WHERE medicamentoID = $1
          )
        `;
        const checkOrderResult = await pool.query(checkOrderQuery, [med.medicamentoid]);
        if (checkOrderResult.rows[0].count == 0) {
          const createOrderQuery = `
            INSERT INTO servicosBD.Encomenda (estadoID, adminID, fornecedorID, aprovadoPorAdministrador, encomendaCompleta, dataEncomenda, dataEntrega, quantidadeEnviada)
            VALUES (1, 1, 1, false, false, NOW(), NOW() + interval '7 days', $1)
            RETURNING encomendaID
          `;
          const createOrderResult = await pool.query(createOrderQuery, [med.quantidademinima - med.quantidadedisponivel]);
          const newOrderID = createOrderResult.rows[0].encomendaid;

          const linkMedicationQuery = `
            INSERT INTO servicosBD.Medicamento_Encomenda (medicamentoID, encomendaID, quantidade)
            VALUES ($1, $2, $3)
          `;
          await pool.query(linkMedicationQuery, [med.medicamentoid, newOrderID, med.quantidademinima - med.quantidadedisponivel]);

          console.log(`Order created for ${med.nomemedicamento}, Service: ${med.localidadeServico || 'Unknown'} (${med.tipoServico || 'Unknown'})`);
        } else {
          console.log(`Order already exists for ${med.nomemedicamento}, Service: ${med.localidadeServico || 'Unknown'} (${med.tipoServico || 'Unknown'})`);
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
