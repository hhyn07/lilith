'use strict'
// Lilith (feature 27): a user follows a team (the team page's follower count; followers
// are told about changes to the team's public notes, lib/notify.js)

module.exports = function (sequelize, DataTypes) {
  const LilithFollow = sequelize.define('LilithFollow', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    teamId: { type: DataTypes.UUID, allowNull: false }
  }, { tableName: 'LilithFollows' })

  LilithFollow.associate = function (models) {
    // a deleted account's follows go with it (a deleted team's: lib/teams.js dropTeam)
    models.User.addHook('afterDestroy', 'lilithFollows', function (user) {
      return LilithFollow.destroy({ where: { userId: user.id } })
    })
  }
  return LilithFollow
}
