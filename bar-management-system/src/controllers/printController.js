const { printHeader } = require('../services/businessSettingsService');
const { Comanda, ComandaItem, Product, User, Table } = require('../models');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateComandaReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { copy = false } = req.query;

    const comanda = await Comanda.findByPk(id, {
      include: [
        {
          model: Table,
          as: 'table',
          attributes: ['id', 'tableNumber'],
          required: false
        },
        {
          model: User,
          as: 'openedByUser',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'closedByUser',
          attributes: ['id', 'username'],
          required: false
        },
        {
          model: ComandaItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'unitOfMeasure', 'category']
            }
          ]
        }
      ]
    });

    if (!comanda) {
      return res.status(404).json({ error: 'Comanda not found' });
    }

    // Criar PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    // Configurar headers para download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=comanda-${id}${copy ? '-copia' : ''}.pdf`);
    
    // Pipe do PDF para a resposta
    doc.pipe(res);

    // Cabeçalho
    const business = await printHeader(doc);
    doc.moveDown();

    if (copy) {
      doc.fontSize(16).text('*** SEGUNDA VIA ***', { align: 'center' });
      doc.moveDown();
    }

    // Informações da comanda
    doc.fontSize(14).text(`CUPOM FISCAL - COMANDA #${comanda.id.substring(0, 8).toUpperCase()}`, { align: 'center' });
    doc.moveDown();

    // Dados do cliente/mesa
    if (comanda.type === 'mesa' && comanda.table) {
      doc.fontSize(12).text(`Mesa: ${comanda.table.tableNumber}`);
    } else {
      doc.text(`Cliente: ${comanda.customerName || 'Balcão'}`);
      if (comanda.customerPhone) {
        doc.text(`Telefone: ${comanda.customerPhone}`);
      }
    }

    doc.text(`Atendente: ${comanda.openedByUser.username}`);
    doc.text(`Abertura: ${new Date(comanda.openedAt).toLocaleString('pt-BR')}`);
    
    if (comanda.closedAt) {
      doc.text(`Fechamento: ${new Date(comanda.closedAt).toLocaleString('pt-BR')}`);
    }
    
    doc.moveDown();

    // Linha separadora
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Cabeçalho da tabela de itens
    doc.fontSize(10);
    const tableTop = doc.y;
    doc.text('ITEM', 50, tableTop);
    doc.text('QTD', 200, tableTop);
    doc.text('UNIT.', 250, tableTop);
    doc.text('TOTAL', 350, tableTop);

    // Linha separadora
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
    doc.moveDown();

    // Itens da comanda
    let currentY = doc.y;
    comanda.items.forEach((item, index) => {
      const itemY = currentY + (index * 20);
      
      // Nome do produto (quebrar linha se necessário)
      const productName = item.product.name.length > 25 
        ? item.product.name.substring(0, 25) + '...' 
        : item.product.name;
      
      doc.text(productName, 50, itemY);
      doc.text(item.quantity.toString(), 200, itemY);
      doc.text(`R$ ${parseFloat(item.priceAtSale).toFixed(2)}`, 250, itemY);
      doc.text(`R$ ${parseFloat(item.totalItemValue).toFixed(2)}`, 350, itemY);
    });

    // Atualizar posição Y
    doc.y = currentY + (comanda.items.length * 20) + 10;

    // Linha separadora
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Totais
    doc.fontSize(12);
    doc.text(`Subtotal: R$ ${parseFloat(comanda.totalValue).toFixed(2)}`, { align: 'right' });
    
    if (comanda.discountValue > 0) {
      doc.text(`Desconto: R$ ${parseFloat(comanda.discountValue).toFixed(2)}`, { align: 'right' });
    }
    
    if (comanda.discountPercentage > 0) {
      const percentDiscount = (parseFloat(comanda.totalValue) * parseFloat(comanda.discountPercentage)) / 100;
      doc.text(`Desconto (${comanda.discountPercentage}%): R$ ${percentDiscount.toFixed(2)}`, { align: 'right' });
    }

    doc.fontSize(14).text(`TOTAL: R$ ${parseFloat(comanda.finalValue || comanda.totalValue).toFixed(2)}`, { align: 'right' });
    doc.moveDown();

    // Método de pagamento
    if (comanda.paymentMethod) {
      const paymentMethods = {
        'dinheiro': 'Dinheiro',
        'cartao_credito': 'Cartão de Crédito',
        'cartao_debito': 'Cartão de Débito',
        'pix': 'PIX',
        'vale_refeicao': 'Vale Refeição'
      };
      
      doc.fontSize(12).text(`Forma de Pagamento: ${paymentMethods[comanda.paymentMethod] || comanda.paymentMethod}`);
    }

    // Status do pagamento
    if (comanda.paymentStatus) {
      const statusLabels = {
        'pago': 'PAGO',
        'pendente': 'PENDENTE',
        'nao_pago': 'NÃO PAGO'
      };
      
      doc.text(`Status: ${statusLabels[comanda.paymentStatus] || comanda.paymentStatus}`);
    }

    doc.moveDown();

    // Observações
    if (comanda.notes) {
      doc.text(`Observações: ${comanda.notes}`);
      doc.moveDown();
    }

    // Rodapé
    doc.fontSize(10);
    doc.text(business.receiptMessage, { align: 'center' });
    doc.text('Volte sempre!', { align: 'center' });
    doc.moveDown();
    doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

    // Finalizar PDF
    doc.end();

  } catch (error) {
    console.error('Generate receipt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const generateSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, format = 'pdf' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // Buscar dados do relatório
    const comandas = await Comanda.findAll({
      where: {
        status: 'fechada',
        closedAt: {
          [require('sequelize').Op.gte]: new Date(startDate),
          [require('sequelize').Op.lte]: new Date(endDate)
        }
      },
      include: [
        {
          model: User,
          as: 'openedByUser',
          attributes: ['username']
        },
        {
          model: Table,
          as: 'table',
          attributes: ['tableNumber'],
          required: false
        }
      ],
      order: [['closedAt', 'DESC']]
    });

    if (format === 'pdf') {
      // Gerar PDF
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio-vendas-${startDate}-${endDate}.pdf`);
      
      doc.pipe(res);

      // Cabeçalho
      doc.fontSize(18).text('RELATÓRIO DE VENDAS', { align: 'center' });
      await printHeader(doc);
      doc.moveDown();

      // Período
      doc.text(`Período: ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`);
      doc.moveDown();

      // Resumo
      const totalVendas = comandas.reduce((sum, c) => sum + parseFloat(c.finalValue || c.totalValue), 0);
      const totalComandas = comandas.length;
      const ticketMedio = totalComandas > 0 ? totalVendas / totalComandas : 0;

      doc.fontSize(14).text('RESUMO EXECUTIVO');
      doc.fontSize(12);
      doc.text(`Total de Comandas: ${totalComandas}`);
      doc.text(`Faturamento Total: R$ ${totalVendas.toFixed(2)}`);
      doc.text(`Ticket Médio: R$ ${ticketMedio.toFixed(2)}`);
      doc.moveDown();

      // Tabela de comandas
      doc.fontSize(14).text('DETALHAMENTO DAS VENDAS');
      doc.fontSize(10);

      const tableTop = doc.y + 10;
      doc.text('DATA', 50, tableTop);
      doc.text('COMANDA', 120, tableTop);
      doc.text('MESA/CLIENTE', 200, tableTop);
      doc.text('ATENDENTE', 300, tableTop);
      doc.text('VALOR', 450, tableTop);

      // Linha separadora
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      let currentY = tableTop + 25;
      comandas.forEach((comanda, index) => {
        if (currentY > 750) { // Nova página se necessário
          doc.addPage();
          currentY = 50;
        }

        const itemY = currentY + (index % 30) * 15;
        
        doc.text(new Date(comanda.closedAt).toLocaleDateString('pt-BR'), 50, itemY);
        doc.text(comanda.id.substring(0, 8), 120, itemY);
        
        const location = comanda.table 
          ? `Mesa ${comanda.table.tableNumber}` 
          : (comanda.customerName || 'Balcão');
        doc.text(location.substring(0, 15), 200, itemY);
        
        doc.text(comanda.openedByUser.username.substring(0, 15), 300, itemY);
        doc.text(`R$ ${parseFloat(comanda.finalValue || comanda.totalValue).toFixed(2)}`, 450, itemY);

        if ((index + 1) % 30 === 0) {
          currentY = 50;
        }
      });

      // Rodapé
      doc.fontSize(10);
      doc.text(`Relatório gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

      doc.end();
    } else {
      // Retornar JSON
      res.json({
        period: { startDate, endDate },
        summary: {
          totalComandas: comandas.length,
          totalVendas: comandas.reduce((sum, c) => sum + parseFloat(c.finalValue || c.totalValue), 0),
          ticketMedio: comandas.length > 0 
            ? comandas.reduce((sum, c) => sum + parseFloat(c.finalValue || c.totalValue), 0) / comandas.length 
            : 0
        },
        comandas
      });
    }

  } catch (error) {
    console.error('Generate sales report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const generateProductReport = async (req, res) => {
  try {
    const { startDate, endDate, format = 'pdf' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // Buscar dados dos produtos
    const { ComandaItem } = require('../models');
    const { Op } = require('sequelize');

    const productData = await ComandaItem.findAll({
      where: {
        created_at: {
          [Op.gte]: new Date(startDate),
          [Op.lte]: new Date(endDate)
        }
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['name', 'category', 'unitOfMeasure']
        },
        {
          model: Comanda,
          as: 'comanda',
          where: { status: 'fechada' },
          attributes: []
        }
      ],
      attributes: [
        'productId',
        [ComandaItem.sequelize.fn('SUM', ComandaItem.sequelize.col('quantity')), 'totalQuantity'],
        [ComandaItem.sequelize.fn('SUM', ComandaItem.sequelize.col('total_item_value')), 'totalRevenue'],
        [ComandaItem.sequelize.fn('COUNT', ComandaItem.sequelize.col('ComandaItem.id')), 'orderCount']
      ],
      group: ['productId', 'product.id'],
      order: [[ComandaItem.sequelize.fn('SUM', ComandaItem.sequelize.col('total_item_value')), 'DESC']]
    });

    if (format === 'pdf') {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio-produtos-${startDate}-${endDate}.pdf`);
      
      doc.pipe(res);

      // Cabeçalho
      doc.fontSize(18).text('RELATÓRIO DE PRODUTOS', { align: 'center' });
      await printHeader(doc);
      doc.moveDown();

      // Período
      doc.text(`Período: ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`);
      doc.moveDown();

      // Tabela de produtos
      doc.fontSize(10);
      const tableTop = doc.y;
      doc.text('PRODUTO', 50, tableTop);
      doc.text('CATEGORIA', 200, tableTop);
      doc.text('QTD', 300, tableTop);
      doc.text('PEDIDOS', 350, tableTop);
      doc.text('RECEITA', 450, tableTop);

      // Linha separadora
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      let currentY = tableTop + 25;
      productData.forEach((item, index) => {
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
        }

        const itemY = currentY + (index % 35) * 15;
        
        doc.text(item.product.name.substring(0, 25), 50, itemY);
        doc.text(item.product.category.substring(0, 15), 200, itemY);
        doc.text(parseFloat(item.dataValues.totalQuantity).toFixed(1), 300, itemY);
        doc.text(item.dataValues.orderCount.toString(), 350, itemY);
        doc.text(`R$ ${parseFloat(item.dataValues.totalRevenue).toFixed(2)}`, 450, itemY);

        if ((index + 1) % 35 === 0) {
          currentY = 50;
        }
      });

      doc.end();
    } else {
      res.json({
        period: { startDate, endDate },
        products: productData
      });
    }

  } catch (error) {
    console.error('Generate product report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const reprintReceipt = async (req, res) => {
  try {
    // Redirecionar para generateComandaReceipt com parâmetro copy=true
    req.query.copy = true;
    return generateComandaReceipt(req, res);
  } catch (error) {
    console.error('Reprint receipt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  generateComandaReceipt,
  generateSalesReport,
  generateProductReport,
  reprintReceipt
};

