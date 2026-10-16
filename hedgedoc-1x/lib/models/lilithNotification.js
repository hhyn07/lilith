'use strict'
// Lilith (feature 26): a notification for one user (see lib/notify.js)
const Sequelize = require('sequelize')

module.exports = function (sequelize, DataTypes) {
  const LilithNotification = sequelize.define('LilithNotification', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    kind: { type: DataTypes.STRING, allowNull: false },
    noteId: { type: DataTypes.UUID, allowNull: true },
    teamId: { type: DataTypes.UUID, allowNull: true },
    actors: {
      type: DataTypes.TEXT,
      get: function () { return sequelize.processData(this.getDataValue('actors'), [], JSON.parse) },
      set: function (value) { this.setDataValue('actors', JSON.stringify(value || [])) }
    },
    data: {
      type: DataTypes.TEXT,
      get: function () { return sequelize.processData(this.getDataValue('data'), {}, JSON.parse) },
      set: function (value) { this.setDataValue('data', JSON.stringify(value || {})) }
    },
    readAt: { type: DataTypes.DATE, allowNull: true }
  }, { tableName: 'LilithNotifications' })

  LilithNotification.associate = function (models) {
    // a deleted account's notifications go with it
    models.User.addHook('afterDestroy', 'lilithNotifications', function (user) {
      return LilithNotification.destroy({ where: { userId: user.id } })
    })
    // a new revision = someone changed the note: tell the people who follow it
    models.Revision.addHook('afterCreate', 'lilithNotifications', function (revision) {
      // after the revision is saved, without holding up the saver
      setImmediate(() => require('../notify').noteChanged(revision))
    })
  }
  return LilithNotification
}
