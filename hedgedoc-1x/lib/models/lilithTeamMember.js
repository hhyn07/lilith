'use strict'
// Lilith (feature 24): a member of a team -- owner (made the team, one per team) / admin / member
const Sequelize = require('sequelize')

module.exports = function (sequelize, DataTypes) {
  const LilithTeamMember = sequelize.define('LilithTeamMember', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    teamId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'member' }
  }, { tableName: 'LilithTeamMembers' })

  LilithTeamMember.associate = function (models) {
    // deleting an account: leave every team; a team it owned goes to an admin (or a
    // member), or is deleted when nobody is left (its notes go back to their creators).
    // Reads the tables, not lib/teams.js's copy: the copy is only loaded in the server
    // process (scripts that delete users do not have it).
    models.User.addHook('afterDestroy', 'lilithTeams', async function (user) {
      const teams = require('../teams')
      const mine = await LilithTeamMember.findAll({ where: { userId: user.id } })
      for (const row of mine) {
        await teams.removeMember(row.teamId, user.id)
        if (row.role !== 'owner') continue
        const rest = await LilithTeamMember.findAll({ where: { teamId: row.teamId }, order: [['createdAt', 'ASC']] })
        const heir = rest.find(m => m.role === 'admin') || rest[0]
        if (heir) await teams.setMember(row.teamId, heir.userId, 'owner')
        else await teams.dropTeam(row.teamId)
      }
    })
  }
  return LilithTeamMember
}
