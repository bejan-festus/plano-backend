import model from 'tango-api-schema';

export async function find( query={}, field={} ) {
  return model.storeModel.find( query, field );
}

export async function findOne( query={}, field={} ) {
  return model.storeModel.findOne( query, field );
}

export async function insertMany( data ) {
  return model.storeModel.insertMany( data );
}

export async function aggregate( query ) {
  return model.storeModel.aggregate( query );
}

export async function updateOne( query, record ) {
  return model.storeModel.updateOne( query, { $set: record } );
}
