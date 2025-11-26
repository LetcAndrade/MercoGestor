import type { Request, Response, NextFunction } from "express";
import { db } from "../config/firebase";

/* ------------------------- helpers ------------------------- */

function toNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

function normStr(v?: string | null) {
  return (v ?? "").trim();
}

async function ensureCategoryExists(categoriaRaw?: string | null): Promise<string | null> {
  const categoria = normStr(categoriaRaw);
  if (!categoria) return null;

  const categoriaLower = categoria.toLowerCase();
  const col = db.collection("categorias");

  // 1) Tenta por campo normalizado (bases novas)
  let qs = await col.where("categoriaLower", "==", categoriaLower).limit(1).get();

  // 2) Fallback p/ bases antigas (campo "categoria" simples)
  if (qs.empty) {
    qs = await col.where("categoria", "==", categoria).limit(1).get();
  }


  // Não existe → cria
  const doc = await col.add({
    categoria,
    categoriaLower,
    createdAt: new Date(),
  });
  return doc.id;
}

/* ------------------------- CREATE ------------------------- */

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // agora aceitamos estoqueInicial no body
    let { nome, unidade, minimo, preco, categoria, estoqueInicial } = req.body as {
      nome?: string; unidade?: string; minimo?: any; preco?: any; categoria?: string | null; estoqueInicial?: any;
    };

    nome = normStr(nome);
    unidade = normStr(unidade);
    categoria = normStr(categoria);

    const minimoNum = toNumber(minimo);
    const precoNum  = toNumber(preco);
    const estoqueInicialNum = Math.max(0, toNumber(estoqueInicial) ?? 0);

    if (!nome || !unidade || minimoNum === undefined) {
      return res.status(400).json({
        success: false,
        error: "Nome, unidade e quantidade mínima são obrigatórios.",
      });
    }

    // Garante categoria (cria se não existir). Se vazio, salva vazio mesmo.
    await ensureCategoryExists(categoria);

    // Evita duplicidade por (nome + categoria)
    const productsRef = db.collection("produtos");
    const dup = await productsRef
      .where("nome", "==", nome)
      .where("categoria", "==", categoria ?? "")
      .limit(1)
      .get();

    if (!dup.empty) {
      return res.status(409).json({ success: false, error: "Produto já existe." });
    }

    const newProduct = {
      nome,
      unidade,
      minimo: minimoNum!,
      preco: precoNum ?? null,
      categoria: categoria ?? "",
      createdAt: new Date(),
    };

    const productRef = await productsRef.add(newProduct);

    // 🔥 Movimento de estoque inicial (se informado)
    if (estoqueInicialNum > 0) {
      const now = new Date().toISOString();
      await db.collection("movimentos").add({
        productId: productRef.id,
        tipo: "in",
        quantidade: estoqueInicialNum,
        data: now,          // algumas partes do app usam 'data'
        date: now,          // outras usam 'date'
        source: "initial_stock",
        createdAt: new Date(),
      });
    }

    return res.status(201).json({
      success: true,
      message: "Produto cadastrado com sucesso!",
      productId: productRef.id,
      product: { id: productRef.id, ...newProduct },
    });
  } catch (error) {
    next(error);
  }
};

/* ------------------------- READ ALL ------------------------- */

export const getProducts = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const snap = await db.collection("produtos").get();
    if (snap.empty) {
      return res.status(200).json({ success: true, message: "Nenhum produto cadastrado.", products: [] });
    }

    const products = snap.docs.map(d => ({ id: d.id, ...(d.data() ?? {}) }));
    return res.status(200).json({ success: true, products });
  } catch (error) {
    next(error);
  }
};

/* ------------------------- READ ONE ------------------------- */

export const getProductById = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const doc = await db.collection("produtos").doc(id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: "Produto não encontrado." });

    return res.status(200).json({ success: true, product: { id: doc.id, ...(doc.data() ?? {}) } });
  } catch (error) {
    next(error);
  }
};

/* ------------------------- UPDATE ------------------------- */

export const updateProduct = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const ref = db.collection("produtos").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Produto não encontrado." });

    const { nome, unidade, minimo, preco, categoria } = req.body as {
      nome?: string; unidade?: string; minimo?: any; preco?: any; categoria?: string | null;
    };

    const updated: Record<string, any> = {};

    if (nome !== undefined) {
      const v = normStr(nome);
      if (!v) return res.status(400).json({ success: false, error: "Nome não pode ser vazio." });
      updated.nome = v;
    }
    if (unidade !== undefined) {
      const v = normStr(unidade);
      if (!v) return res.status(400).json({ success: false, error: "Unidade não pode ser vazia." });
      updated.unidade = v;
    }
    if (minimo !== undefined) {
      const n = toNumber(minimo);
      if (n === undefined) return res.status(400).json({ success: false, error: "Ponto de reposição inválido." });
      updated.minimo = n;
    }
    if (preco !== undefined) {
      const n = toNumber(preco);
      updated.preco = n ?? null;
    }
    if (categoria !== undefined) {
      const v = normStr(categoria);
      if (v) {
        await ensureCategoryExists(v); // cria se não existir
        updated.categoria = v;
      } else {
        updated.categoria = ""; // permitir limpar
      }
    }

    if (Object.keys(updated).length === 0) {
      return res.status(400).json({ success: false, error: "Nenhum campo para atualização foi enviado." });
    }

    await ref.update({ ...updated, updatedAt: new Date() });

    const updatedDoc = await ref.get();
    return res.status(200).json({
      success: true,
      message: "Produto atualizado com sucesso!",
      product: { id: updatedDoc.id, ...(updatedDoc.data() ?? {}) },
    });
  } catch (error) {
    next(error);
  }
};

/* ------------------------- DELETE ------------------------- */

export const deleteProduct = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const ref = db.collection("produtos").doc(id);
    const snap = await ref.get();

    if (!snap.exists) return res.status(404).json({ success: false, error: "Produto não encontrado." });

    // Remove movimentos do produto (em chunks de 500)
    const movs = await db.collection("movimentos").where("productId", "==", id).get();
    if (!movs.empty) {
      const docs = movs.docs;
      for (let i = 0; i < docs.length; i += 500) {
        const chunk = docs.slice(i, i + 500);
        const batch = db.batch();
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }

    const data = snap.data() ?? {};
    await ref.delete();

    return res.status(200).json({
      success: true,
      message: "Produto removido com sucesso!",
      deletedProduct: { id, ...data },
    });
  } catch (error) {
    next(error);
  }
};
