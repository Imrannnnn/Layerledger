const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { defineConfig } = require('prisma/config');

const dbUrl = process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: dbUrl,
  },
});
