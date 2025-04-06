import model from 'tango-api-schema';

export async function find( query={}, field={} ) {
  return model.planoMappingModel.find( query, field );
}
export async function findOne( query={}, field={} ) {
  return model.planoMappingModel.findOne( query, field );
}

export async function insertMany( data ) {
  return model.planoMappingModel.insertMany( data );
}

export async function aggregate( query ) {
  return model.planoMappingModel.aggregate( query );
}

export async function updateOne( query, record ) {
  return model.planoMappingModel.updateOne( query, { $set: record } );
}

export async function count( query ) {
  return model.planoMappingModel.countDocuments( query );
}

export async function create( data ) {
  return model.planoMappingModel.create( data );
}

export async function deleteOne( query ) {
  return model.planoMappingModel.deleteOne( query );
}

export async function deleteMany( query ) {
  return model.planoMappingModel.deleteMany( query );
}

export async function upsertOne( query, record ) {
  return model.planoMappingModel.findOneAndUpdate(
      query,
      record,
      { upsert: true, new: true },
  );
}