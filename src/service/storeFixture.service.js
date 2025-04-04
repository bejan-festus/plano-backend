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

export async function findOneAndUpdate( query={}, field={} ) {
  return model.storeFixtureModel.findOneAndUpdate( query, field );
}

export async function findOneAndUpdate2( query={}, field={} ) {
  return model.storeFixtureModel.findOneAndUpdate( query, field, { new: true } );
}

export async function create( data ) {
  return model.storeFixtureModel.create( data );
}

export async function deleteOne( query ) {
  return model.storeFixtureModel.deleteOne( query );
}

export async function findAndSort( query={}, field={}, sortField={} ) {
  return model.storeFixtureModel.find( query, field ).sort( sortField );
}
