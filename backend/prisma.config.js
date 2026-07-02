const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { defineConfig } = require('prisma/config');

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL environment variable is not defined.");
}

if (!dbUrl.startsWith('postgres') && !dbUrl.startsWith('file:') && !dbUrl.startsWith('sqlite:')) {
  throw new Error("DATABASE_URL must start with 'postgres', 'postgresql', 'file:', or 'sqlite:'.");
}

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: dbUrl,
  },
});
