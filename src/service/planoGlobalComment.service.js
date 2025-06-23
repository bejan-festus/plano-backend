import model from 'tango-api-schema';

export async function create( data ) {
  return model.planoGlobalComment.create( data );
}

export async function findOne( query = {}, field = {} ) {
  return model.planoGlobalComment.findOne( query, field );
}

export async function updateOne( query = {}, record = {} ) {
  return model.planoGlobalComment.updateOne( query, { $set: record }, { upsert: true } );
}

export async function deleteMany( query = {} ) {
  return model.planoGlobalComment.deleteMany( query );
}

export async function aggregate( query = {} ) {
  return model.planoGlobalComment.aggregate( query );
}

export async function find( query = {}, field = {} ) {
  return model.planoGlobalComment.find( query, field );
}
