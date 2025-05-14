import model from 'tango-api-schema';

export async function find( query={}, field={} ) {
  return model.planoVmModel.find( query, field );
}

export async function findOne( query={}, field={} ) {
  return model.planoVmModel.findOne( query, field );
}
export async function findAndSort( query={}, field={}, sort={} ) {
  return model.planoVmModel.find( query, field ).sort( sort ).collation( { locale: 'en_US', numericOrdering: true } );
}

export async function insertMany( data ) {
  return model.planoVmModel.insertMany( data );
}

export async function aggregate( query ) {
  return model.planoVmModel.aggregate( query );
}

export async function deleteOne( query ) {
  return model.planoVmModel.deleteOne( query );
}

export async function create( data ) {
  return model.planoVmModel.create( data );
}

export async function updateOne( query, record ) {
  return model.planoVmModel.updateOne( query, { $set: record }, { upsert: true } );
}

export async function count( query ) {
  return model.planoVmModel.countDocuments( query );
}
