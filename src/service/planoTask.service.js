import model from 'tango-api-schema';

export async function create( data ) {
  return model.planoTaskCompliance.create( data );
}

export async function updateOne( query={}, record={} ) {
  return model.planoTaskCompliance.updateOne( query, { $set: record }, { upsert: true } );
}

export async function count( data ) {
  return model.planoTaskCompliance.countDocuments( data );
}

export async function findOne( query={}, field={} ) {
  return model.planoTaskCompliance.findOne( query, field );
}