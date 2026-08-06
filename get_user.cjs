const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
p.user.findUnique({where:{id:'cms80vrth0001l06u1rip4c4v'},select:{name:true,email:true}}).then(console.log).finally(()=>p.$disconnect())
