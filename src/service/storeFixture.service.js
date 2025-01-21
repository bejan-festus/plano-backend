import model from 'tango-api-schema';

export async function find( query={}, field={} ) {
  return model.storeFixtureModel.find( query, field );
}

export async function findOne( query={}, field={} ) {
  return model.storeFixtureModel.findOne( query, field );
}

export async function insertMany( data ) {
  return model.storeFixtureModel.insertMany( data );
}

export async function aggregate( query ) {
  return model.storeFixtureModel.aggregate( query );
}

export async function updateOne( query, record ) {
  return model.storeFixtureModel.updateOne( query, { $set: record } );
}
