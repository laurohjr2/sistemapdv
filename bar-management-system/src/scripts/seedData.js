require('dotenv').config();
const { sequelize, User, Product, Table } = require('../models');

async function seedDatabase() {
  try {
    // Sync database
    await sequelize.sync({ force: true });
    console.log('Database synced successfully');

    // Create admin user
    const adminUser = await User.create({
      username: 'admin',
      passwordHash: 'admin123',
      role: 'admin'
    });
    console.log('Admin user created');

    // Create manager user
    const managerUser = await User.create({
      username: 'gerente',
      passwordHash: 'gerente123',
      role: 'gerente'
    });
    console.log('Manager user created');

    // Create waiter user
    const waiterUser = await User.create({
      username: 'garcom1',
      passwordHash: 'garcom123',
      role: 'garcom'
    });
    console.log('Waiter user created');

    // Create sample products
    const products = [
      // Bebidas
      {
        name: 'Cerveja Skol 350ml',
        category: 'Bebida Alcoólica',
        unitOfMeasure: 'unidade',
        costPrice: 2.50,
        salePrice: 5.00,
        currentStock: 100,
        minStockAlert: 20
      },
      {
        name: 'Cerveja Heineken 350ml',
        category: 'Bebida Alcoólica',
        unitOfMeasure: 'unidade',
        costPrice: 3.50,
        salePrice: 7.00,
        currentStock: 50,
        minStockAlert: 10
      },
      {
        name: 'Whisky Red Label',
        category: 'Bebida Alcoólica',
        unitOfMeasure: 'litro',
        costPrice: 80.00,
        salePrice: 15.00, // por dose
        currentStock: 5,
        minStockAlert: 1
      },
      {
        name: 'Coca-Cola 350ml',
        category: 'Refrigerante',
        unitOfMeasure: 'unidade',
        costPrice: 2.00,
        salePrice: 4.00,
        currentStock: 80,
        minStockAlert: 15
      },
      {
        name: 'Água Mineral 500ml',
        category: 'Bebida',
        unitOfMeasure: 'unidade',
        costPrice: 1.00,
        salePrice: 3.00,
        currentStock: 60,
        minStockAlert: 10
      },
      // Comidas
      {
        name: 'Hambúrguer Artesanal',
        category: 'Lanche',
        unitOfMeasure: 'unidade',
        costPrice: 8.00,
        salePrice: 18.00,
        currentStock: 30,
        minStockAlert: 5
      },
      {
        name: 'Batata Frita Porção',
        category: 'Petisco',
        unitOfMeasure: 'unidade',
        costPrice: 3.00,
        salePrice: 8.00,
        currentStock: 25,
        minStockAlert: 5
      },
      {
        name: 'Pastel de Queijo',
        category: 'Petisco',
        unitOfMeasure: 'unidade',
        costPrice: 1.50,
        salePrice: 4.00,
        currentStock: 40,
        minStockAlert: 10
      },
      {
        name: 'Picanha na Chapa',
        category: 'Prato Principal',
        unitOfMeasure: 'unidade',
        costPrice: 15.00,
        salePrice: 35.00,
        currentStock: 20,
        minStockAlert: 3
      },
      {
        name: 'Porção de Torresmo',
        category: 'Petisco',
        unitOfMeasure: 'unidade',
        costPrice: 4.00,
        salePrice: 12.00,
        currentStock: 15,
        minStockAlert: 3
      }
    ];

    for (const productData of products) {
      await Product.create(productData);
    }
    console.log('Sample products created');

    // Create sample tables
    for (let i = 1; i <= 20; i++) {
      await Table.create({
        tableNumber: i,
        capacity: i <= 10 ? 4 : 6,
        status: 'disponivel'
      });
    }
    console.log('Sample tables created');

    console.log('Database seeded successfully!');
    console.log('\nDefault users created:');
    console.log('Admin: username=admin, password=admin123');
    console.log('Manager: username=gerente, password=gerente123');
    console.log('Waiter: username=garcom1, password=garcom123');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;

