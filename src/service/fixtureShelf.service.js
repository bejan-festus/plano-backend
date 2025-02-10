import model from 'tango-api-schema';

export async function find( query={}, field={} ) {
  return model.fixtureShelfModel.find( query, field );
}

export async function findOne( query={}, field={} ) {
  return model.fixtureShelfModel.findOne( query, field );
}

export async function insertMany( data ) {
  return model.fixtureShelfModel.insertMany( data );
}

export async function aggregate( query ) {
  return model.fixtureShelfModel.aggregate( query );
}

export async function updateOne( query, record ) {
  return model.fixtureShelfModel.updateOne( query, { $set: record } );
}

export async function create( data ) {
  return model.fixtureShelfModel.create( data );
}

export async function count( data ) {
  return model.fixtureShelfModel.countDocuments( data );
}
