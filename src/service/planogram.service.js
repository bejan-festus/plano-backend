import model from 'tango-api-schema';

export async function find( query={}, field={} ) {
  return model.planogramModel.find( query, field );
}

export async function findOne( query={}, field={} ) {
  return model.planogramModel.findOne( query, field );
}

export async function insertMany( data ) {
  return model.planogramModel.insertMany( data );
}

export async function aggregate( query ) {
  return model.planogramModel.aggregate( query );
}

export async function updateOne( query, record ) {
  return model.planogramModel.updateOne( query, record );
}

export async function updateMany( query, record ) {
  return model.planogramModel.updateMany( query, { $set: record } );
}

export async function deleteOne( query ) {
  return model.planogramModel.deleteOne( query );
}

export async function upsertOne( query, record ) {
  return model.planogramModel.findOneAndUpdate(
      query,
      record,
      { upsert: true, new: true },
  );
}

export async function create( data ) {
  return model.planogramModel.create( data );
}
