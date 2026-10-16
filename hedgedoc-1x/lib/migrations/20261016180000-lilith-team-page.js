'use strict'
// Lilith (feature 27): team public page like HackMD's.
//   LilithTeams        + bio, public e-mail, custom links, picture, pinned notes
//   LilithFollows      who follows a team
//   LilithLikes        who likes a note
module.exports = {
  up: async function (queryInterface, Sequelize) {
    await queryInterface.addColumn('LilithTeams', 'bio', { type: Sequelize.TEXT, allowNull: true })
    await queryInterface.addColumn('LilithTeams', 'email', { type: Sequelize.STRING, allowNull: true })
    await queryInterface.addColumn('LilithTeams', 'links', { type: Sequelize.TEXT, allowNull: true })
    await queryInterface.addColumn('LilithTeams', 'photo', { type: Sequelize.TEXT, allowNull: true })
    await queryInterface.addColumn('LilithTeams', 'pinned', { type: Sequelize.TEXT, allowNull: true })
    await queryInterface.createTable('LilithFollows', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.UUID, allowNull: false },
      teamId: { type: Sequelize.UUID, allowNull: false },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    })
    await queryInterface.addIndex('LilithFollows', ['userId', 'teamId'], { unique: true, name: 'lilith_follows_user_team' })
    await queryInterface.addIndex('LilithFollows', ['teamId'], { name: 'lilith_follows_team' })
    await queryInterface.createTable('LilithLikes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.UUID, allowNull: false },
      noteId: { type: Sequelize.UUID, allowNull: false },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    })
    await queryInterface.addIndex('LilithLikes', ['userId', 'noteId'], { unique: true, name: 'lilith_likes_user_note' })
    await queryInterface.addIndex('LilithLikes', ['noteId'], { name: 'lilith_likes_note' })
  },

  down: async function (queryInterface, Sequelize) {
    await queryInterface.dropTable('LilithLikes')
    await queryInterface.dropTable('LilithFollows')
    for (const c of ['pinned', 'photo', 'links', 'email', 'bio']) await queryInterface.removeColumn('LilithTeams', c)
  }
}
