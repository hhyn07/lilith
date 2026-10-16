'use strict'
// Lilith (feature 24): a note that belongs to a team (at most one team per note)
const Sequelize = require('sequelize')

module.exports = function (sequelize, DataTypes) {
  return sequelize.define('LilithTeamNote', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    teamId: { type: DataTypes.UUID, allowNull: false },
    noteId: { type: DataTypes.UUID, allowNull: false }
  }, { tableName: 'LilithTeamNotes' })
}
