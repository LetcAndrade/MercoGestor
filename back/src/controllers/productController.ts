import type { Request, Response, NextFunction } from "express";
import { db } from "../config/firebase";

// Create a product.
export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
    // Attempts to create a product, and if an error occurs, passes the error to the error handler.
    try {
        // 1. Pegar dados do corpo da requisição
        const { nome, preco, categoria, estoque } = req.body;

        // 2. Validação dos dados recebidos
        if (!nome || !preco || !categoria) {
            // Retorna um erro 400 (Bad Request) se faltarem dados essenciais
            return res.status(400).json({
                sucesso: false,
                erro: 'Nome, preço e categoria são obrigatórios.'
            });
        }

        // 3. Criar o objeto do produto com os dados validados
        const novoProduto = {
            nome: nome,
            preco: parseFloat(preco),
            categoria: categoria,
            estoque: parseInt(estoque) || 0, // Garante um valor padrão de 0 se o estoque não for fornecido
            dataCadastro: new Date()
        };

        // 4. Salvar o novo produto no Firebase Firestore
        const produtoRef = await db.collection('produtos').add(novoProduto);

        // 5. Retornar uma resposta de sucesso (201 - Created)
        res.status(201).json({
            sucesso: true,
            mensagem: 'Produto cadastrado com sucesso!',
            produtoId: produtoRef.id
        });

    } catch (error) {
        // 6. Se ocorrer qualquer erro durante o processo, passa para o próximo middleware (error handler)
        // Isso mantém o código mais limpo, delegando o tratamento de erros a um local centralizado.
        next(error);
    }
};

// Read all products.
export const getProducts = (req: Request, res: Response, next: NextFunction) => {
    // Attempts to read the products, and if an error occurs, passes the error to the error handler.
};

// Read single product.
export const getProductById = (req: Request, res: Response, next: NextFunction) => {
    // Attempts to read a product, and if an error occurs, passes the error to the error handler.
};

// Update a product.
export const updateProduct = (req: Request, res: Response, next: NextFunction) => {
    // Attempts to update a product, and if an error occurs, passes the error to the error handler.
};

// Delete a product.
export const deleteProduct = (req: Request, res: Response, next: NextFunction) => {
    // Attempts to delete a product, and if an error occurs, passes the error to the next function.
};