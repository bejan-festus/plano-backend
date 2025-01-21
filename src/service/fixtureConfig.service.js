import model from 'tango-api-schema';


export async function find( query={}, field={} ) {
  return model.fixtureConfigModel.find( query, field );
}


export async function findOne( query={}, field={} ) {
  return model.fixtureConfigModel.findOne( query, field );
}


export async function insertMany( data ) {
  return model.fixtureConfigModel.insertMany( data );
}


export async function aggregate( query ) {
  return model.fixtureConfigModel.aggregate( query );
}


export async function updateOne( query, record ) {
  return model.fixtureConfigModel.updateOne( query, { $set: record } );
}

