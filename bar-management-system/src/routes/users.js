function createRouter() {
const express = require('express');
const { getAllUsers, getUserById, updateUser, deleteUser } = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const { register } = require('../controllers/authController');
const { User } = require('../models');

// All routes require authentication
router.use(authenticateToken);

router.post('/', authorizeRoles('admin'), register);
router.put('/:id/password', authorizeRoles('admin'), async(req,res,next)=>{
 try {
  const user=await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({error:'Usuário não encontrado'});
  if(typeof req.body.newPassword!=='string'||req.body.newPassword.length<6) return res.status(400).json({error:'Senha deve ter ao menos seis caracteres'});
  if(!(await user.validatePassword(req.body.currentPassword || ''))) return res.status(400).json({error:'Senha atual inválida'});
  await user.update({passwordHash:req.body.newPassword});
  res.json({message:'Senha alterada'});
 }catch(error){next(error)}
});
// Admin only routes
router.get('/', authorizeRoles('admin'), getAllUsers);
router.get('/:id', authorizeRoles('admin'), getUserById);
router.put('/:id', authorizeRoles('admin'), updateUser);
router.delete('/:id', authorizeRoles('admin'), deleteUser);

return router;


}
module.exports=require('../tenancy/scopedModule').router(createRouter);
