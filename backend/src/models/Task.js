const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  dueTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  isDone: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  lastNotifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  notifyTypes: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() {
      const raw = this.getDataValue('notifyTypes');
      return raw ? JSON.parse(raw) : [];
    },
    set(value) {
      this.setDataValue('notifyTypes', JSON.stringify(value || []));
    },
  },
  recipients: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() {
      const raw = this.getDataValue('recipients');
      return raw ? JSON.parse(raw) : [];
    },
    set(value) {
      this.setDataValue('recipients', JSON.stringify(value || []));
    },
  },
  notifyCycle: {
    type: DataTypes.STRING,
    defaultValue: 'none',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: User, key: 'id' },
  },
});

User.hasMany(Task, { foreignKey: 'userId', onDelete: 'CASCADE' });
Task.belongsTo(User, { foreignKey: 'userId' });

module.exports = Task;
