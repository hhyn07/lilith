'use strict'
// Lilith (feature 28): team settings like HackMD's.
//   LilithTeams + handle   the team's address (/t/<handle>), a-z 0-9 and "-", unique
//               + privacy  "open" (anyone sees the public page) or "closed" (members only)
module.exports = {
  up: async function (queryInterface, Sequelize) {
    await queryInterface.addColumn('LilithTeams', 'handle', { type: Sequelize.STRING, allowNull: true })
    await queryInterface.addColumn('LilithTeams', 'privacy', { type: Sequelize.STRING, allowNull: false, defaultValue: 'open' })
    await queryInterface.addIndex('LilithTeams', ['handle'], { unique: true, name: 'lilith_teams_handle' })
  },

  down: async function (queryInterface, Sequelize) {
    await queryInterface.removeIndex('LilithTeams', 'lilith_teams_handle')
    await queryInterface.removeColumn('LilithTeams', 'privacy')
    await queryInterface.removeColumn('LilithTeams', 'handle')
  }
}
