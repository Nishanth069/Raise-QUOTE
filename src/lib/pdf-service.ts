import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

interface PDFData {
  quotation: any
  items: any[]
  settings: any
  user: any
  selectedTerms?: { title: string; text: string }[]
  currency?: 'INR' | 'USD'
}

export const generateQuotationPDF = async ({ quotation, items, settings, user, selectedTerms, currency = 'INR' }: PDFData) => {

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const currencySymbol = currency === 'INR' ? '₹' : '$'
  const currencyLabel = currency === 'INR' ? 'INR' : 'USD'

  const drawPageBorder = () => {
    // Outer Blue Border
    doc.setDrawColor(0, 82, 156)
    doc.setLineWidth(1.2)
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10)
    
    // Inner Orange Border
    doc.setDrawColor(255, 102, 0)
    doc.setLineWidth(0.8)
    doc.rect(7, 7, pageWidth - 14, pageHeight - 14)

    // Footer contact box
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.3)
    doc.rect(margin + 10, pageHeight - 15, pageWidth - (margin * 2) - 20, 8)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(0)
    doc.text("Write us: info@raiselabequip.com / sales@raiselabequip.com | Contact: +91 91777 70365", pageWidth / 2, pageHeight - 9.5, { align: "center" })
  }

  const drawHeader = (logoBase64: string) => {
    // Logo on top-left
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", margin, 12, 50, 18)
    }

    // Address on top-right
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(0)
    const address = "C-6, B1, Industrial Park, Moula Ali,\nHyderabad, Secunderabad,\nTelangana 500040"
    const splitAddress = doc.splitTextToSize(address, 70)
    doc.text(splitAddress, pageWidth - margin, 14, { align: "right" })

    doc.setDrawColor(0, 82, 156)
    doc.setLineWidth(0.5)
    doc.line(margin, 35, pageWidth - margin, 35)
    doc.setDrawColor(255, 102, 0)
    doc.setLineWidth(0.3)
    doc.line(margin, 36, pageWidth - margin, 36)
  }

  // Pre-load quotation logo (fixed path)
  let logoBase64 = ""
  try {
    logoBase64 = await getBase64ImageFromURL('/quotation-logo.png')
  } catch (e) {
    console.warn("Could not load quotation logo", e)
  }

  // Pre-load item images in parallel with optimized caching
  const itemImages: Record<string, { base64: string; isWide: boolean }> = {}
  const imagePromises = items
    .filter(item => item.image_url)
    .map(async (item) => {
      try {
        const { base64, width, height } = await getBase64ImageWithDimensions(item.image_url!)
        const isWide = width > height * 1.3 // Consider wide if aspect ratio > 1.3
        itemImages[item.id] = { base64, isWide }
      } catch (e) {
        console.warn(`Could not load item image for ${item.id}`, e)
      }
    })
  
  await Promise.all(imagePromises)

  // Start Drawing
  drawPageBorder()
  drawHeader(logoBase64)

  let currentY = 45
  let isFirstPage = true

  items.forEach((item, index) => {
    if (index > 0) {
      doc.addPage()
      drawPageBorder()
      drawHeader(logoBase64)
      currentY = 45
    }

    // Technical & Commercial Offer Title
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.text("Technical & Commercial Offer", pageWidth / 2, currentY, { align: "center" })
    currentY += 6
    doc.setFontSize(10)
    doc.text(`For ${item.name}`, pageWidth / 2, currentY, { align: "center" })
    currentY += 10

    // "To" block - first thing after header
    if (isFirstPage) {
      autoTable(doc, {
        startY: currentY,
        body: [[
          { content: `To\n\n${quotation.customer_name}${quotation.customer_address ? '\n' + quotation.customer_address : ''}`, styles: { fontStyle: "bold", fontSize: 9 } },
          { content: `Quote No: ${quotation.quotation_number}\n\nDate: ${new Date(quotation.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}\n\nValidity: ${(() => {
            const validityDate = new Date(quotation.created_at || Date.now())
            validityDate.setDate(validityDate.getDate() + 30)
            return validityDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
          })()}`, styles: { fontSize: 9 } }
        ]],
        theme: "grid",
        bodyStyles: {
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          cellPadding: 4,
          valign: "top"
        },
        columnStyles: {
          0: { cellWidth: 100, halign: "left" },
          1: { cellWidth: 65, halign: "left" }
        },
        margin: { left: margin, right: margin }
      })
      currentY = (doc as any).lastAutoTable.finalY + 8
      isFirstPage = false
    }

    // Description
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text("Description:", margin, currentY)
    currentY += 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    const splitDesc = doc.splitTextToSize(item.description || "", pageWidth - (margin * 2))
    doc.text(splitDesc, margin, currentY)
    currentY += (splitDesc.length * 4) + 3

    const imageData = itemImages[item.id]
    
    // Get features and image format option from item
    const imageFormat = item.image_format || 'wide' // 'wide' or 'tall'
    const features = item.features || [
      "Accurate method for determining the strength of antibiotic material",
      "Microprocessor based design",
      "Average of Vertical diameter & Horizontal diameter of inhibited zone",
      "Magnified image of inhibited zone is clearly visible on the prism Screen",
      "Calibration facility with certified coins",
      "Inbuilt thermal printer",
      "Parallel printer port & RS 232 port for taking Test Printer Report",
      "Password protection for Real Time Clock",
      "Membrane Keypad for easy operation",
      "Complies to cGMP (MOC-stainless steel -304 & Stainless Steel-316)",
      "IQ/OQ Documentation"
    ]

    // Image layout based on admin selection
    if (imageFormat === 'wide') {
      // Show wide image below description
      if (imageData.base64) {
        const imgWidth = pageWidth - (margin * 2) - 20
        const imgHeight = 50
        doc.addImage(imageData.base64, "PNG", margin + 10, currentY, imgWidth, imgHeight)
        currentY += imgHeight + 8
      }

      // Features below image
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.text("FEATURES:", margin, currentY)
      currentY += 5
      
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      features.forEach((f: string) => {
        doc.text("•", margin + 3, currentY)
        const splitFeature = doc.splitTextToSize(f, pageWidth - (margin * 2) - 10)
        doc.text(splitFeature, margin + 8, currentY)
        currentY += splitFeature.length * 3.5
      })
      currentY += 5
    } else {
      // Tall/Normal image layout: Features on left, image on right
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.text("FEATURES:", margin, currentY)
      currentY += 5
      
      const featureStartY = currentY
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      
      const maxFeatureWidth = imageData?.base64 ? 100 : pageWidth - (margin * 2) - 10
      features.forEach((f: string) => {
        doc.text("•", margin + 3, currentY)
        const splitFeature = doc.splitTextToSize(f, maxFeatureWidth)
        doc.text(splitFeature, margin + 8, currentY)
        currentY += splitFeature.length * 3.5
      })

      // Tall/Normal image on the right
      if (imageData?.base64) {
        doc.addImage(imageData.base64, "PNG", pageWidth - margin - 55, featureStartY - 3, 50, 50)
      }

      currentY = Math.max(currentY + 5, featureStartY + 55)
    }

    // Specification
    if (item.specs && item.specs.length > 0) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.text("Specifications:", margin, currentY)
      currentY += 5
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)

      item.specs.forEach((s: { key: string; value: string }) => {
        doc.text("•", margin + 3, currentY)
        doc.text(s.key, margin + 8, currentY)
        doc.text(s.value.startsWith(":") ? s.value : `: ${s.value}`, margin + 55, currentY)
        currentY += 4
      })
      currentY += 5
    }

    // Check if we need a new page for commercial offer
    if (currentY > pageHeight - 80) {
      doc.addPage()
      drawPageBorder()
      drawHeader(logoBase64)
      currentY = 45
    }

    // Commercial Offer - formatted nicely
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text("Commercial Offer:", margin, currentY)
    currentY += 5

    const tableRows = []
    
    // Main Product Row
    const unitPrice = item.price + (item.selectedAddons?.reduce((s: number, a: any) => s + a.price, 0) || 0)
    
    // Description Cell Content
    let descContent = item.name
    if (item.selectedAddons && item.selectedAddons.length > 0) {
      descContent += "\n\nStandard Accessories:"
      item.selectedAddons.forEach((addon: any) => {
        descContent += `\n• ${addon.name}`
      })
    }

    tableRows.push([
      { content: "01", styles: { halign: "center", valign: "middle", fontSize: 9 } },
      { content: descContent, styles: { halign: "left", valign: "middle", fontSize: 9, cellPadding: 3 } },
      { content: "1", styles: { halign: "center", valign: "middle", fontSize: 9 } },
      { content: `${currencySymbol} ${unitPrice.toLocaleString()}/-`, styles: { halign: "right", fontStyle: "bold", valign: "middle", fontSize: 12, cellPadding: 3 } }
    ])

    autoTable(doc, {
      startY: currentY,
      head: [["S.No", "Description", "Qty", `Price (${currencyLabel})`]],
      body: tableRows,
      theme: "grid",
      headStyles: {
        fillColor: [0, 82, 156],
        textColor: [255, 255, 255],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        fontStyle: "bold",
        halign: "center",
        fontSize: 9
      },
      bodyStyles: {
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        fontSize: 9,
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 15, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 15, halign: "center" },
        3: { cellWidth: 45, halign: "right" }
      },
      margin: { left: margin, right: margin }
    })

    currentY = (doc as any).lastAutoTable.finalY + 10
  })

  // Second Page: Terms & Conditions
  doc.addPage()
  drawPageBorder()
  drawHeader(logoBase64)

  currentY = 45
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("Terms And Conditions:", margin, currentY)
  currentY += 8

  doc.setFontSize(9)
  doc.text("HSN CODE", margin, currentY)
  currentY += 4
  doc.setFont("helvetica", "normal")
  doc.text("84799031", margin + 5, currentY)
  currentY += 8

  const termsToDisplay = selectedTerms && selectedTerms.length > 0 ? selectedTerms : [
    { title: "1. Taxes", text: "18% GST extra applicable" },
    { title: "2. Packaging & Forwarding", text: "Extra As Applicable" },
    { title: "3. Fright", text: "T0 Pay / Extra as applicable" },
    { title: "4. DELIVERY", text: "We deliver the order in 3-4 Weeks from the date of receipt of purchase order" },
    { title: "5. INSTALLATION", text: "Fees extra as applicable" },
    { title: "6. PAYMENT", text: "100% payment at the time of proforma invoice prior to dispatch." },
    { title: "7. WARRANTY", text: "One year warranty from the date of dispatch" },
    { title: "8. GOVERNING LAW", text: "These Terms and Conditions and any action related hereto shall be governed, controlled, interpreted and defined by and under the laws of the State of Telangana" },
    { title: "9. MODIFICATION", text: "Any modification of these Terms and Conditions shall be valid only if it is in writing and signed by the authorized representatives of both Supplier and Customer." }
  ]

  termsToDisplay.forEach((t, idx) => {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    const fullText = `${t.title}: ${t.text}`
    const splitT = doc.splitTextToSize(fullText, pageWidth - (margin * 2))
    doc.text(splitT, margin, currentY)
    currentY += (splitT.length * 4) + 2
  })

  currentY += 10
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text(`From ${settings?.company_name || "Raise Lab Equipment"}`, pageWidth - margin, currentY, { align: "right" })
  currentY += 5
  doc.text(user?.full_name?.toUpperCase() || "SALES TEAM", pageWidth - margin, currentY, { align: "right" })
  currentY += 5
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  if (user?.phone) {
    doc.text(`Contact: ${user.phone}`, pageWidth - margin, currentY, { align: "right" })
  } else {
    doc.text("Contact: +91 91777 70365", pageWidth - margin, currentY, { align: "right" })
  }

  const pdfName = `${quotation.quotation_number}_Quotation.pdf`
  doc.save(pdfName)
  
  return doc.output("blob")
}

const getBase64ImageFromURL = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.setAttribute("crossOrigin", "anonymous")
    img.onload = () => {
      const canvas = document.createElement("canvas")
      // Optimize: Reduce image size for PDFs (max width 800px)
      const maxWidth = 800
      const scale = img.width > maxWidth ? maxWidth / img.width : 1
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext("2d")
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
      // Use JPEG with 85% quality for smaller file size
      const dataURL = canvas.toDataURL("image/jpeg", 0.85)
      resolve(dataURL)
    }
    img.onerror = (error) => {
      reject(error)
    }
    img.src = url
  })
}

const getBase64ImageWithDimensions = (url: string): Promise<{ base64: string; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.setAttribute("crossOrigin", "anonymous")
    img.onload = () => {
      const canvas = document.createElement("canvas")
      // Optimize: Reduce image size for PDFs (max width 800px)
      const maxWidth = 800
      const scale = img.width > maxWidth ? maxWidth / img.width : 1
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext("2d")
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
      // Use JPEG with 85% quality for smaller file size
      const dataURL = canvas.toDataURL("image/jpeg", 0.85)
      resolve({ base64: dataURL, width: img.width, height: img.height })
    }
    img.onerror = (error) => {
      reject(error)
    }
    img.src = url
  })
}
