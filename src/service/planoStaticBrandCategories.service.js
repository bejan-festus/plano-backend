import model from 'tango-api-schema';

export async function find( query={}, field={} ) {
  return model.planoStaticBrandCategories.find( query, field );
}
export async function findOne( query={}, field={} ) {
  return model.planoStaticBrandCategories.findOne( query, field );
}
