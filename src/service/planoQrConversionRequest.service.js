import model from 'tango-api-schema';

export async function find( query={}, field={} ) {
  return model.planoQrConversionRequest.find( query, field );
}
export async function findOne( query={}, field={} ) {
  return model.planoQrConversionRequest.findOne( query, field );
}

export async function insertMany( data ) {
  return model.planoQrConversionRequest.insertMany( data );
}

export async function aggregate( query ) {
  return model.planoQrConversionRequest.aggregate( query );
}

export async function updateOne( query, record ) {
  return model.planoQrConversionRequest.updateOne( query, { $set: record } );
}

export async function count( query ) {
  return model.planoQrConversionRequest.countDocuments( query );
}

export async function create( data ) {
  return model.planoQrConversionRequest.create( data );
}

export async function upsertOne( query, record ) {
  return model.planoQrConversionRequest.updateOne( query, { $set: record }, { upsert: true } );
}
