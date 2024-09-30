import { Router } from "express";
import {PrismaClient} from '@prisma/client';
import ExcelJS from 'exceljs';

const router=Router();
const prisma =new PrismaClient();

async function validarNuevoComprador(prisma,email_vendedor,nombre_comprador){
  try{
    const ticketExists= await prisma.clientes.findFirst({
      where:{
        vendedor:email_vendedor,
        comprador:nombre_comprador
      }
    })
    if(ticketExists)return false
    else return true;
  } catch{
    return true
  } 
}
//valida que la cantidad de tickets no sea 
async function validarCantidadTickets(prisma,email_vendedor,cantidadTickets, tickets_Ref){
  try{
    const ticketsQuantity=await prisma.usuarios.findUnique({
      where:{email:email_vendedor},
      select:{
        tickets_contador:true,
      }
    })
    if((parseInt(ticketsQuantity.tickets_contador)+parseInt(cantidadTickets))-tickets_Ref<=20) return true
    else return false;
  } catch{
    return false
  } 
}

async function obtenerCompradoresYContador(prisma, email_vendedor) {
  try {
    // Obtener los compradores registrados
    const compradores = await prisma.clientes.findMany({
      where: { vendedor: email_vendedor }
    });

    // Contar el número de clientes con el mismo campo comprador
    const compradoresCount = await prisma.clientes.groupBy({
      by: ['comprador'],
      _count: {
        comprador: true,
      },
      where: {
        vendedor: email_vendedor,
      },
    });

    // Crear un mapa de contadores por comprador
    const contadorMap = compradoresCount.reduce((map, item) => {
      map[item.comprador] = item._count.comprador;
      return map;
    }, {});

    // Crear un Set para asegurar que solo se incluya un objeto por comprador
    const compradoresSet = new Map();

    // Modificar los compradores para incluir el campo contador
    compradores.forEach(cliente => {
      if (!compradoresSet.has(cliente.comprador)) {
        compradoresSet.set(cliente.comprador, {
          ...cliente,
          contador: contadorMap[cliente.comprador] || 0
        });
      }
    });

    // Convertir el Set a un array
    const compradoresConContador = Array.from(compradoresSet.values());

    // Obtener el usuario (vendedor)
    const newusuario = await prisma.usuarios.findUnique({
      where: { email: email_vendedor }
    });

    let admins = ["alberto.gil@unmsm.edu.pe","leonidas.garcial@unmsm.edu.pe","diego.espinozap@unmsm.edu.pe"];

    const response = {
      nombre: newusuario.nombre,
      email: newusuario.email,
      contador: newusuario.tickets_contador,
      compradores: compradoresConContador,
      admin: false
    };
    
    // Añadir la propiedad 'admin' solo si el email está en el array de administradores
    if (admins.includes(email_vendedor)) {
      response.admin = true;
    }
    
    // Devolver el JSON con los datos
    return response;

  } catch (error) {
    // Devolver el error
    return { error: 'Error al obtener los datos' };
  }
}


router.get('/usuarios', async (req, res) => {
    const respuesta=await prisma.usuarios.findMany();
    res.json(respuesta)
});

//enpoin de login
router.post('/login', async (req, res) => {
  const { email, contrasena } = req.body;

  // Verificar si se han enviado los parámetros
  if (!email || !contrasena) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  try {
    // Buscar el usuario en la base de datos
    const user = await prisma.usuarios.findUnique({
      where: { email: email },
    });

    // Verificar si el usuario existe y si la contraseña es correcta
    if (user && user.contrasena_hash === contrasena) {
      const vendedor = user.email;

      //funicon login
      const datos = await obtenerCompradoresYContador(prisma, email);

      if (datos.error) {
        res.status(500).json(datos);  // Devolver el error
      } else {
        res.status(201).json(datos);  // Devolver los datos
      }

    } else {
      res.status(401).json({ error: 'Usuario o contraseña incorrectos' });    
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en la solicitud' });
  }
});

//para registrar byevos usuarios B======3
router.post('/register', async (req, res) => {
  const { nombre_comprador, telefono_comprador, email_vendedor, tickets_numero } = req.body;

  // Verificar que se hayan enviado los parámetros requeridos
  if (!nombre_comprador || !telefono_comprador || !email_vendedor || !tickets_numero) {
    return res.status(400).json({ error: 'Nombre del comprador, teléfono del comprador, y nombre del vendedor son requeridos' });
  }
  //validar que el usuario exista
   const validar=prisma.usuarios.findUnique({
    where:{email:email_vendedor},
  })
  if (validar){
    //validar que sea un comprador nuevo
    const compradorNuevo= await validarNuevoComprador(prisma,email_vendedor,nombre_comprador);
    if(compradorNuevo){
      try {
        //validar que el numero sea <= a 20
        const ticketsLimit = await validarCantidadTickets(prisma,email_vendedor,tickets_numero, 0);
        if(ticketsLimit){
          // Crear los nuevos clientes en la base de datos
          let iniciador = 0;
          while (iniciador < tickets_numero) {
            await prisma.clientes.create({
              data: {
                vendedor: email_vendedor,
                comprador: nombre_comprador,
                telefono: parseInt(telefono_comprador), // Asegúrate de que el teléfono sea un número entero
              },
            });
            iniciador += 1;  
          }
        
          // Verificar si el usuario existe
          if (validar) {
            // Actualizar el campo tickets_contador del usuario
            const usuario=await prisma.usuarios.findUnique({where:{email:email_vendedor}});
            const usuarioActualizado = await prisma.usuarios.update({
              where: { email: email_vendedor },
              data: {
                tickets_contador: usuario.tickets_contador + parseInt(tickets_numero), // Incrementar por el número de tickets
              },
            });
      
            const datos = await obtenerCompradoresYContador(prisma, email_vendedor);
      
            if (datos.error) {
              res.status(500).json(datos);  // Devolver el error
            } else {
              res.status(201).json(datos);  // Devolver los datos
            }
            
          } else {
            // Si el usuario no existe, devolver una respuesta adecuada
            res.status(404).json({ error: 'Usuario no encontrado' });
          }
        }else{
          res.status(404).json({ error: 'Cantidad limite de tickets superada' });
        }        
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar el cliente o actualizar el usuario' });
      }
    }else{
      res.status(404).json({ error: 'Comprador ya existe' });
    }    
  }else{
    res.status(404).json({ error: 'Usuario no encontrado' });
  }
  
});

router.post('/deleteCLientes', async (req, res) => {
  await prisma.clientes.deleteMany();
  await prisma.usuarios.update({
    where:{email:"leonidas.garcial@unmsm.edu.pe"},
    data:{
      tickets_contador:0,
    }
  })
});

//enpoin para actualizar datos
router.post('/actualizar', async (req, res) => {
  const { nombre_comprador, telefono_comprador, email_vendedor, tickets_numero, tickets_Ref } = req.body;

  // Propiedades esperadas
  const propiedadesEsperadas = ['nombre_comprador', 'telefono_comprador', 'email_vendedor', 'tickets_numero'];
  
  // Verificar propiedades adicionales
  const propiedadesRecibidas = Object.keys(req.body);
  const propiedadesNoEsperadas = propiedadesRecibidas.filter(prop => !propiedadesEsperadas.includes(prop));
 
  // Verificar que se hayan enviado los parámetros requeridos
  if (!telefono_comprador || !email_vendedor || !tickets_numero) {
    return res.status(400).json({ error: 'Nombre del comprador, teléfono del comprador, y nombre del vendedor son requeridos' });
  }
  //verificar que el comprador ya exista
  if(nombre_comprador==""){
    res.status(401).json({
      error:"Comprador no existe"
    })
  }else{
    //verificar que no pase de 20 los tickets
    const ticketLimits = await validarCantidadTickets(prisma,email_vendedor,tickets_numero, tickets_Ref);
    if(ticketLimits){
      const verificar=await prisma.usuarios.findUnique({
        where:{email:email_vendedor}
      })  
      if(verificar){
        //validar que exista el comprador 
        const compradorCheck=await prisma.clientes.findFirst({
          where:{
            vendedor:email_vendedor,
            comprador:nombre_comprador
          }
        })
        if(compradorCheck){
          const totalClientes = await prisma.clientes.count({
            where: {
              vendedor: email_vendedor,
              comprador: nombre_comprador
            }
          });
        
          if(parseInt(tickets_numero)<=0){
            
          }else{
            if(parseInt(totalClientes)==parseInt(tickets_numero)){
              
            }
            else if (parseInt(tickets_numero)<parseInt(totalClientes)){//estas restando
              const resta=parseInt(totalClientes)-parseInt(tickets_numero);
              let contador=0;
              while(contador<resta){
                const cliente = await prisma.clientes.findFirst({
                  where: {
                    vendedor: email_vendedor,
                    comprador: nombre_comprador
                  }
                });
                // Elimina el cliente encontrado
                await prisma.clientes.delete({
                  where: {
                    id: cliente.id  // Utiliza el ID del cliente encontrado para eliminarlo
                  }
                });
                const UserVendedor=await prisma.usuarios.findUnique({
                  where:{email:email_vendedor}
                })
                await prisma.usuarios.update({
                  where: { email: email_vendedor },
                  data: {
                    tickets_contador: UserVendedor.tickets_contador - 1
                  }
                });
        
                contador++;
              }      
            }
            else if (parseInt(tickets_numero)>parseInt(totalClientes)){//estas sumando
              const resta=parseInt(tickets_numero)-parseInt(totalClientes);
              let contador=0;
              while(contador<resta){
                await prisma.clientes.create({
                  data: {
                    vendedor: email_vendedor,
                    comprador: nombre_comprador,
                    telefono: parseInt(telefono_comprador), // Asegúrate de que el teléfono sea un número entero
                  },
                });       
        
                const UserVendedor=await prisma.usuarios.findUnique({
                  where:{email:email_vendedor}
                })
                await prisma.usuarios.update({
                  where: { email: email_vendedor },
                  data: {
                    tickets_contador: UserVendedor.tickets_contador + 1
                  }
                });            
                contador++;
              }  
            }
            
          }
          
          const telefonos = await prisma.clientes.findFirst({
            where:{
              vendedor:email_vendedor,
              comprador:nombre_comprador
            },
            select:{
              telefono:true
            }
          })
          
          if(parseInt(telefonos)!=parseInt(telefono_comprador)){
            
            // Actualizar todas las filas donde comprador coincide con nombre_comprador
            const restt = await prisma.clientes.updateMany({
              where: { 
                comprador: nombre_comprador,
                vendedor: email_vendedor
              },
              data: { telefono: parseInt(telefono_comprador) }
            });
          }
          
          if ('nuevo_comprador' in req.body) {
            const nuevo_comprador = req.body.nuevo_comprador;
      
            // Actualizar todas las filas donde comprador coincide con nombre_comprador
            const resultado = await prisma.clientes.updateMany({
              where: { 
                comprador: nombre_comprador,
                vendedor: email_vendedor
              },
              data: { comprador: nuevo_comprador }
            });
          }
                  
          const datos = await obtenerCompradoresYContador(prisma, email_vendedor);
      
          if (datos.error) {
            res.status(500).json(datos);  // Devolver el error
          } else {
            res.status(201).json(datos);  // Devolver los datos
          }
        }else{
          res.status(401).json({
            error:"Comprador antiguo no existe"
          })
        }        
    
      }else{
        res.status(401).json({
          error:"Usuario no existe"
        })
      }
    }else{
      res.status(401).json({
        error:"Limite de tickets excedido"
      })
    }    
  }    

});

router.post('/erase', async (req, res) => {
  const { nombre_comprador, email_vendedor } = req.body;

  const usuario= await prisma.usuarios.findUnique({
    where:{email:email_vendedor}
  })
  if(usuario){
    const buyer=await prisma.clientes.findFirst({
      where:{comprador:nombre_comprador}
    })
    if(buyer){
      // Contar el número de compradores que coinciden con los criterios
      const cantidadAEliminar = await prisma.clientes.count({
        where: {
          vendedor: email_vendedor,
          comprador: nombre_comprador
        }
      });
      
      const resultado = await prisma.clientes.deleteMany({
        where: {
          vendedor:email_vendedor,
          comprador:nombre_comprador
        }
      });
      const UserVendedor=await prisma.usuarios.findUnique({
        where:{email:email_vendedor}
      })
      await prisma.usuarios.update({
        where: { email: email_vendedor },
        data: {
          tickets_contador: UserVendedor.tickets_contador - (cantidadAEliminar),
        }
      });

      const datos = await obtenerCompradoresYContador(prisma, email_vendedor);

      if (datos.error) {
        res.status(500).json(datos);  // Devolver el error
      } else {
        res.status(201).json(datos);  // Devolver los datos
      }
    }
    else{
      res.status(402).json({error:"No existe el comprador"})
    }    
  }else{
    res.status(401).json({error:"No existe el usuario"})
  }
  

});
//metodo get para descargar informacion de la nube en tablas
router.post('/download-excel-vendedores', async (req, res) => {
  const { email_vendedor } = req.body;
  let admins = ["alberto.gil@unmsm.edu.pe","leonidas.garcial@unmsm.edu.pe","diego.espinozap@unmsm.edu.pe"];

  if(admins.includes(email_vendedor)){
    try {
      // Obtener los datos de la base de datos
      const data = await prisma.usuarios.findMany({
        select: {
          nombre: true,
          email: true,
          tickets_contador: true,
        }
      });
  
      // Crear un nuevo libro de trabajo y una hoja de trabajo
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Vendedores');
  
      // Definir columnas y estilos
      worksheet.columns = [
        { header: 'Nombre', key: 'nombre', width: 40 },
        { header: 'Email', key: 'email', width: 40 },
        { header: 'Tickets Contador', key: 'tickets_contador', width: 20 },
      ];
  
      // Agregar las filas de datos
      data.forEach(vendedor => {
        worksheet.addRow(vendedor);
      });
  
      // Aplicar bordes y estilos a las celdas
      const borderStyle = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
  
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = borderStyle;  // Aplicar bordes a todas las celdas
        });
  
        // Estilos para las filas según el valor de tickets_contador
        if (rowNumber > 1) {  // Saltar el encabezado
          const ticketsValue = row.getCell('tickets_contador').value;
  
          let fillColor;
          if (ticketsValue === 20) {
            fillColor = { argb: 'CCFFCC' };  // Verde si es 20
          } else {
            fillColor = { argb: 'FFCCCC' };  // Rojo si no es 20
          }
  
          // Aplicar color de fondo a toda la fila
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: fillColor,
            };
          });
        }
      });
  
      // Aplicar estilo al encabezado
      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFCCCCCC' }, // Fondo gris para el encabezado
        };
        cell.border = borderStyle;  // Bordes para el encabezado
      });
  
      // Generar el archivo en memoria
      const buffer = await workbook.xlsx.writeBuffer();
  
      // Configurar las cabeceras para la descarga del archivo
      res.setHeader('Content-Disposition', 'attachment; filename=vendedores.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  
      // Enviar el archivo al cliente
      res.send(buffer);
    } catch (error) {
      console.error('Error al generar el archivo Excel:', error);
      res.status(500).send('Error al generar el archivo Excel');
    }
  }else{
    res.status(401).json({error:"Acceso denegado"})
  }
  
});
//metodo get para descargar informacion de la nube en tablas
router.post('/download-excel-compradores', async (req, res) => {
  const { email_vendedor } = req.body;
  let admins = ["alberto.gil@unmsm.edu.pe","leonidas.garcial@unmsm.edu.pe","diego.espinozap@unmsm.edu.pe"];
  if(admins.includes(email_vendedor)){
    try {
      // Obtener los datos de la base de datos
      const data = await prisma.clientes.findMany();
  
      // Crear un nuevo libro de trabajo y una hoja de trabajo
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Datos');
  
      // Definir columnas basadas en los datos obtenidos
      const columns = Object.keys(data[0] || {}).map((key, index) => ({
        header: key,
        key: key,
        width: index === 0 ? 10 : 30 // Ancho de columna específico para la primera columna
      }));
      worksheet.columns = columns;
  
      // Agregar las filas de datos
      data.forEach(cliente => {
        worksheet.addRow(cliente);
      });
  
      // Estilo para los bordes de las celdas
      const thinBorderStyle = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
  
      // Aplicar bordes y estilos a las celdas
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = thinBorderStyle;  // Aplicar bordes a todas las celdas
        });
      });
  
      // Estilo para el encabezado
      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFCCCCCC' } // Fondo gris para el encabezado
        };
        cell.border = thinBorderStyle;  // Bordes para el encabezado
      });
  
      // Generar el archivo en memoria
      const buffer = await workbook.xlsx.writeBuffer();
  
      // Configurar las cabeceras para la descarga del archivo
      res.setHeader('Content-Disposition', 'attachment; filename=compradores.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  
      // Enviar el archivo al cliente
      res.send(buffer);
    } catch (error) {
      console.error('Error al generar el archivo Excel:', error);
      res.status(500).send('Error al generar el archivo Excel');
    }
  }else{
    res.status(401).json({error:"Acceso denegado"})
  }
  
});

export default router;
