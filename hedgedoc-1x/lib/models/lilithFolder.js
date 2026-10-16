'use strict'
// Lilith: a user's own folder for organising the note list (feature 20)
const Sequelize = require('sequelize')

module.exports = function (sequelize, DataTypes) {
  const LilithFolder = sequelize.define('LilithFolder', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    tableName: 'LilithFolders'
  })

  // keep the folder / bookmark tables clean when users or notes go away
  LilithFolder.associate = function (models) {
    // deleting an account (/me/delete) destroys the user instance
    models.User.addHook('afterDestroy', 'lilithFolders', function (user) {
      return Promise.all([
        LilithFolder.destroy({ where: { userId: user.id } }),
        models.LilithNoteMeta.destroy({ where: { userId: user.id } })
      ])
    })
    // a note deleted for good (Note.destroy({ where: { id }, force: true })); a note moved
    // to the trash keeps its folder and bookmark, so restoring brings them back
    models.Note.addHook('afterBulkDestroy', 'lilithNoteMetas', function (options) {
      const id = options && options.force && options.where && options.where.id
      if (typeof id === 'string') return models.LilithNoteMeta.destroy({ where: { noteId: id } })
    })
  }
  return LilithFolder
}
