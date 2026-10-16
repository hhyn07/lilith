'use strict'
// Lilith: third-party identities (GitHub, ...) linked to a user account.
// The linking feature was removed on 2026-10-16 at hhyn's request. This
// migration stays because it already ran on the real database; the table is
// unused and was empty when the feature was removed.
module.exports = {
  up: async function (queryInterface, Sequelize) {
    await queryInterface.createTable('UserIdentities', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false
      },
      providerUserId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      profile: Sequelize.TEXT,
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    })
    await queryInterface.addIndex('UserIdentities', ['provider', 'providerUserId'], {
      unique: true,
      name: 'user_identities_provider_provider_user_id'
    })
    await queryInterface.addIndex('UserIdentities', ['userId'], {
      name: 'user_identities_user_id'
    })
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('UserIdentities')
  }
}
