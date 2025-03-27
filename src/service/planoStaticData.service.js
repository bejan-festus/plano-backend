import model from 'tango-api-schema';

export async function find( query={}, field={} ) {
  return model.planoStaticData.find( query, field );
}
export async function findOne( query={}, field={} ) {
  return model.planoStaticData.findOne( query, field );
}
