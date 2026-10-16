'use strict'
// Lilith (feature 24): a team workspace. Members are in LilithTeamMember, notes in
// LilithTeamNote; the permission checks read lib/teams.js (an in-memory copy).
// Feature 27 (team public page): bio, public e-mail, custom links, picture, pinned notes.
// Feature 28 (team settings): handle (/t/<handle>), privacy (open / closed).
const Sequelize = require('sequelize')

module.exports = function (sequelize, DataTypes) {
  function json (field, empty) {
    return {
      type: DataTypes.TEXT,
      allowNull: true,
      get: function () { return sequelize.processData(this.getDataValue(field), empty, JSON.parse) },
      set: function (value) { this.setDataValue(field, JSON.stringify(value || empty)) }
    }
  }
  return sequelize.define('LilithTeam', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
    name: { type: DataTypes.STRING, allowNull: false },
    inviteToken: { type: DataTypes.STRING, allowNull: true },
    inviteExpiresAt: { type: DataTypes.DATE, allowNull: true },
    bio: { type: DataTypes.TEXT, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    photo: { type: DataTypes.TEXT, allowNull: true },
    links: json('links', []), // [{ label, url }]
    pinned: json('pinned', []), // note ids, at most 3
    // feature 28: the team's address and who sees its public page
    handle: { type: DataTypes.STRING, allowNull: true },
    privacy: { type: DataTypes.STRING, allowNull: false, defaultValue: 'open' }
  }, { tableName: 'LilithTeams' })
}
