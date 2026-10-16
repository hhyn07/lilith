'use strict'
// Lilith (feature 27): a user likes a note (the heart and its count, like HackMD's)

module.exports = function (sequelize, DataTypes) {
  const LilithLike = sequelize.define('LilithLike', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    noteId: { type: DataTypes.UUID, allowNull: false }
  }, { tableName: 'LilithLikes' })

  LilithLike.associate = function (models) {
    models.User.addHook('afterDestroy', 'lilithLikes', function (user) {
      return LilithLike.destroy({ where: { userId: user.id } })
    })
    // deleted for good (Note.destroy({ where: { id }, force: true }), not moved to the
    // trash): its likes go too
    models.Note.addHook('afterBulkDestroy', 'lilithLikes', function (options) {
      const id = options && options.force && options.where && options.where.id
      if (typeof id === 'string') return LilithLike.destroy({ where: { noteId: id } })
    })
  }
  return LilithLike
}
