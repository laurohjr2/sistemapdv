function createScopedModule() {
const { User } = require('../models');
const { logAction } = require('../utils/auditLogger');

const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      where:{platformUserId:null}, paranoid: false, order: [['created_at', 'DESC']]
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {paranoid:false});

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, role, password, email, active } = req.body;

    const user = await User.findByPk(id, {paranoid:false});
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if(user.platformUserId)return res.status(403).json({error:'Conta da plataforma é gerenciada exclusivamente pelo fornecedor'});
    if(username&&['master.local','support.local'].includes(username.trim().toLowerCase()))return res.status(400).json({error:'Nome reservado ao acesso do fornecedor'});
    const updateData = {};
    if (username) updateData.username = username;
    if (role) updateData.role = role;
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }
      updateData.passwordHash = password;
    }

    if (email !== undefined) updateData.email = email;
    if (active !== undefined) {
      if (typeof active !== 'boolean') return res.status(400).json({error:'Status inválido'});
      if (id === req.user.id && !active) return res.status(400).json({error:'Não é possível desativar a própria conta'});
      updateData.active = active;
    }
    if (id === req.user.id && role && role !== 'admin') return res.status(400).json({error:'Não é possível remover seu próprio acesso de administrador'});
    if (active === true && user.deleted_at) await user.restore();
    await user.update(updateData);

    await logAction(req.user.id, 'user_updated', {
      updatedUserId: user.id,
      changes: Object.keys(updateData).filter(key=>key!=='passwordHash')
    });

    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.findByPk(id, {paranoid:false});
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await logAction(req.user.id, 'user_deleted', {
      deletedUserId: user.id,
      username: user.username
    });

    if(user.platformUserId)return res.status(403).json({error:'Conta da plataforma é gerenciada exclusivamente pelo fornecedor'});
    await user.update({active:false});

    res.json({ message: 'Usuário inativado. O histórico foi preservado.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

return {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
};


}
module.exports=require('../tenancy/scopedModule')(createScopedModule,["getAllUsers", "getUserById", "updateUser", "deleteUser"]);
