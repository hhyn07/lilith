'use strict'
// Lilith: personal folders and bookmarks for the note list (feature 20).
// Each user has their own folders; a note can be in one folder per user and
// can be bookmarked ("starred") per user. The note itself is not changed.
module.exports = {
  up: async function (queryInterface, Sequelize) {
    await queryInterface.createTable('LilithFolders', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    })
    await queryInterface.addIndex('LilithFolders', ['userId'], {
      name: 'lilith_folders_user_id'
    })
    await queryInterface.createTable('LilithNoteMetas', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      noteId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      folderId: {
        type: Sequelize.UUID,
        allowNull: true
      },
      starred: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    })
    await queryInterface.addIndex('LilithNoteMetas', ['userId', 'noteId'], {
      unique: true,
      name: 'lilith_note_metas_user_id_note_id'
    })
    await queryInterface.addIndex('LilithNoteMetas', ['noteId'], {
      name: 'lilith_note_metas_note_id'
    })
  },

  down: async function (queryInterface, Sequelize) {
    await queryInterface.dropTable('LilithNoteMetas')
    await queryInterface.dropTable('LilithFolders')
  }
}
