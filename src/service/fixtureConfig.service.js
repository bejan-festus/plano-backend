import model from 'tango-api-schema';

export async function find( query={}, field={} ) {
  return model.fixtureConfigModel.find( query, field );
}

export async function findOne( query={}, field={} ) {
  return model.fixtureConfigModel.findOne( query, field );
}

export async function insertMany( data = [] ) {
  return model.fixtureConfigModel.insertMany( data );
}

export async function aggregate( query = [] ) {
  return model.fixtureConfigModel.aggregate( query );
}

export async function updateOne( query = {}, record = {} ) {
  return model.fixtureConfigModel.updateOne( query, { $set: record } );
}

export async function count( query = {} ) {
  return model.fixtureConfigModel.countDocuments( query );
}

export async function upsertOne( query, record ) {
  return model.fixtureConfigModel.findOneAndUpdate(
      query,
      record,
      { upsert: true, new: true },
  );
}
export async function create( data = {} ) {
  return model.fixtureConfigModel.create( data );
}

export async function deleteOne( query = {} ) {
  return model.fixtureConfigModel.deleteOne( query );
}

export const findAndSort = async ( query={}, field={}, sort={} ) => {
  return await model.fixtureConfigModel.find( query, field ).sort( sort ).collation( { locale: 'en_US', numericOrdering: true } );
};
