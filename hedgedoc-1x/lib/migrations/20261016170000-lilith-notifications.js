'use strict'
// Lilith (feature 26): notifications like HackMD's -- "X and N others changed <note>"
// (with the changes) and team events. One row per message for one user.
module.exports = {
  up: async function (queryInterface, Sequelize) {
    await queryInterface.createTable('LilithNotifications', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.UUID, allowNull: false },
      // change (someone changed a note) / team (added, role, removed, joined, team deleted)
      kind: { type: Sequelize.STRING, allowNull: false },
      noteId: { type: Sequelize.UUID, allowNull: true },
      teamId: { type: Sequelize.UUID, allowNull: true },
      // JSON: who did it (user ids, newest first) and what to show (title, changes, message)
      actors: { type: Sequelize.TEXT, allowNull: true },
      data: { type: Sequelize.TEXT, allowNull: true },
      readAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    })
    await queryInterface.addIndex('LilithNotifications', ['userId', 'updatedAt'], { name: 'lilith_notifications_user_time' })
    await queryInterface.addIndex('LilithNotifications', ['userId', 'noteId', 'kind'], { name: 'lilith_notifications_user_note' })
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('LilithNotifications')
  }
}
