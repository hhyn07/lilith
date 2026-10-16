'use strict'
// Lilith: per-user facts about a note in their list: which folder it is in
// and whether it is bookmarked (feature 20). One row per (user, note).
const Sequelize = require('sequelize')

module.exports = function (sequelize, DataTypes) {
  const LilithNoteMeta = sequelize.define('LilithNoteMeta', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    noteId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    folderId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    starred: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'LilithNoteMetas',
    indexes: [
      {
        unique: true,
        fields: ['userId', 'noteId']
      }
    ]
  })
  return LilithNoteMeta
}
