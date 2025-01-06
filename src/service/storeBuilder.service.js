import model from 'tango-api-schema';

export async function find( query={}, field={} ) {
  return model.storeLayoutModel.find( query, field );
}

export async function findOne( query={}, field={} ) {
  return model.storeLayoutModel.findOne( query, field ).sort( { floorNumber: -1 } );
}

export async function insertMany( data ) {
  return model.storeLayoutModel.insertMany( data );
}

export async function aggregate( query ) {
  return model.storeLayoutModel.aggregate( query );
}

export async function updateOne( query, record ) {
  return model.storeLayoutModel.updateOne( query, { $set: record } );
}
