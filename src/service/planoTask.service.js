import model from 'tango-api-schema';

export async function create( data ) {
  return model.planoTaskCompliance.create( data );
}

export async function updateOne( query={}, record={} ) {
  return model.planoTaskCompliance.updateOne( query, { $set: record }, { upsert: true } );
}
