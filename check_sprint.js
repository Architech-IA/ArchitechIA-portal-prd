const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()
p.sprint.findMany({ include: { items: true } }).then(r => { console.log(JSON.stringify(r, null, 2)); p.$disconnect() })
