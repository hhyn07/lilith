'use strict'
// Lilith (feature 24): team workspaces like HackMD's.
//   LilithTeams        a team: name, invite link token
//   LilithTeamMembers  who is in it: owner / admin / member
//   LilithTeamNotes    which notes belong to it (a note is in at most one team)
module.exports = {
  up: async function (queryInterface, Sequelize) {
    await queryInterface.createTable('LilithTeams', {
      id: { type: Sequelize.UUID, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      inviteToken: { type: Sequelize.STRING, allowNull: true },
      inviteExpiresAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    })
    await queryInterface.addIndex('LilithTeams', ['inviteToken'], { unique: true, name: 'lilith_teams_invite_token' })
    await queryInterface.createTable('LilithTeamMembers', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      teamId: { type: Sequelize.UUID, allowNull: false },
      userId: { type: Sequelize.UUID, allowNull: false },
      role: { type: Sequelize.STRING, allowNull: false, defaultValue: 'member' },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    })
    await queryInterface.addIndex('LilithTeamMembers', ['teamId', 'userId'], { unique: true, name: 'lilith_team_members_team_user' })
    await queryInterface.addIndex('LilithTeamMembers', ['userId'], { name: 'lilith_team_members_user' })
    await queryInterface.createTable('LilithTeamNotes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      teamId: { type: Sequelize.UUID, allowNull: false },
      noteId: { type: Sequelize.UUID, allowNull: false },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    })
    await queryInterface.addIndex('LilithTeamNotes', ['noteId'], { unique: true, name: 'lilith_team_notes_note' })
    await queryInterface.addIndex('LilithTeamNotes', ['teamId'], { name: 'lilith_team_notes_team' })
  },

  down: async function (queryInterface, Sequelize) {
    await queryInterface.dropTable('LilithTeamNotes')
    await queryInterface.dropTable('LilithTeamMembers')
    await queryInterface.dropTable('LilithTeams')
  }
}
